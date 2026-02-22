import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pg from "pg";
import dotenv from "dotenv";
import multer from "multer";
import pdf from "pdf-extraction";

dotenv.config();

// --- 1. Veritabanı ve AI Ayarları ---
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DB_URI,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: process.env.GEMINI_EMBEDDING_MODEL });
const chatModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

// --- 2. Express Ayarları ---
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

function splitTextIntoChunks(text, size, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = start + size;
    const chunk = text.slice(start, end);
    if (chunk.length > 50) chunks.push(chunk);
    start += size - overlap;
  }
  return chunks;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const activeChats = {};

// ==========================================
// 🚀 ENDPOINT: PDF YÜKLEME (UPLOAD)
// ==========================================
app.post("/api/upload", upload.single("document"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Lütfen bir PDF yükleyin." });
  const client = await pool.connect();
  try {
    const pdfData = await pdf(req.file.buffer);
    const rawText = pdfData.text.replace(/\n/g, " ").replace(/\s+/g, " ");
    if (rawText.length < 50) return res.status(400).json({ error: "PDF okunamadı." });

    const chunks = splitTextIntoChunks(rawText, 1000, 100);
    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await embeddingModel.embedContent(chunks[i]);
        const vector = result.embedding.values;
        await client.query("INSERT INTO documents (content, embedding) VALUES ($1, $2)", [chunks[i], JSON.stringify(vector)]);
        successCount++;
        await sleep(500);
      } catch (err) {
        console.error(`⚠️ Parça ${i+1} atlandı (Hata: ${err.message})`);
      }
    }
    res.json({ message: "PDF kaydedildi.", totalChunksSaved: successCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});


// ==========================================
// 🌊 ENDPOINT: SOHBET (STREAMING & HISTORY)
// ==========================================
app.post("/api/chat", async (req, res) => {
  const { question, sessionId = "default_session" } = req.body;
  if (!question) return res.status(400).json({ error: "Soru eksik." });

  // 1. STREAMING İÇİN HTTP BAŞLIKLARINI AYARLA (SSE Formatı)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const client = await pool.connect();
  
  try {
    // 2. RAG: Soruyu vektöre çevir ve ara
    const embeddingResult = await embeddingModel.embedContent(question);
    const vectorStr = JSON.stringify(embeddingResult.embedding.values);

    const sql = `SELECT content, (embedding <=> $1) as distance FROM documents ORDER BY distance ASC LIMIT 3;`;
    const result = await client.query(sql, [vectorStr]);
    
    const contextData = result.rows.length > 0 
      ? result.rows.map(r => r.content).join("\n\n---\n\n")
      : "Veritabanında bu soruya dair doğrudan bir bilgi bulunamadı.";

    // 3. HAFIZA (HISTORY) KONTROLÜ
    if (!activeChats[sessionId]) {
      activeChats[sessionId] = chatModel.startChat({
        history: [
          { role: "user", parts: [{ text: "Sen profesyonel bir asistansın. Sana vereceğim [VERİTABANI BİLGİSİ] bloklarına dayanarak sorularımı cevapla." }] },
          { role: "model", parts: [{ text: "Anladım. Sadece verdiğiniz bilgilere dayanarak cevap vereceğim." }] },
        ]
      });
    }

    const messageToSend = `
      [VERİTABANI BİLGİSİ]:
      ${contextData}

      [KULLANICININ SORUSU]:
      ${question}
    `;

    // 4. STREAMING İŞLEMİ (Büyünün gerçekleştiği yer)
    const currentChat = activeChats[sessionId];
    const chatResult = await currentChat.sendMessageStream(messageToSend); // sendMessageStream kullanıyoruz!

    // Gelen her kelime öbeğini (chunk) anında istemciye (frontend/terminal) akıtıyoruz
    for await (const chunk of chatResult.stream) {
      const chunkText = chunk.text();
      // Server-Sent Events (SSE) standardına uygun formatta veri gönderimi:
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }

    // Akış bittiğinde bağlantıyı kapat
    res.write("data: [DONE]\n\n");
    res.end();

  } catch (error) {
    console.error("❌ Chat Hatası:", error);
    // Stream başladıysa status değiştiremeyiz, bu yüzden hata mesajını stream olarak yollayıp kapatıyoruz
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  } finally {
    client.release();
  }
});

// ==========================================
// 🗑️ ENDPOINT: HAFIZAYI SİL
// ==========================================
app.delete("/api/chat/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  if (activeChats[sessionId]) {
    delete activeChats[sessionId];
    res.json({ message: `Hafıza silindi: ${sessionId}` });
  } else {
    res.json({ message: "Bu oturum zaten yok." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 RAG API Sunucusu çalışıyor: http://localhost:${PORT}`);
});
