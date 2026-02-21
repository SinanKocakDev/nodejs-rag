import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pg from "pg";
import dotenv from "dotenv";
import multer from "multer"; // YENİ: Dosya yüklemek için
import pdf from "pdf-extraction"; // YENİ: PDF okumak için

dotenv.config();

// --- 1. Veritabanı ve AI Ayarları ---
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DB_URI,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: process.env.GEMINI_EMBEDDING_MODEL });
const chatModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

// --- 2. Express ve Multer Ayarları ---
const app = express();
app.use(cors());
app.use(express.json());

// Multer Ayarı: Yüklenen dosyayı diske kaydetmeden direkt RAM'de (memory) tutalım
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT;

// YARDIMCI FONKSİYON: Metni Parçalara Böl
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

// YARDIMCI FONKSİYON: Bekleme (Rate Limit için)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 🚀 YENİ ENDPOINT: PDF YÜKLEME (UPLOAD)
// ==========================================
// 'document' adında bir dosya bekliyoruz
app.post("/api/upload", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Lütfen bir PDF dosyası yükleyin." });
  }

  const client = await pool.connect();

  try {
    console.log(`\n📥 Yeni Dosya Geldi: ${req.file.originalname}`);

    // 1. PDF'i Bellekten Oku
    const pdfData = await pdf(req.file.buffer);
    const rawText = pdfData.text.replace(/\n/g, " ").replace(/\s+/g, " ");

    if (rawText.length < 50) {
      return res.status(400).json({ error: "PDF okunamadı veya içi boş (Resim tabanlı olabilir)." });
    }

    // 2. Parçalara Böl
    const chunks = splitTextIntoChunks(rawText, 1000, 100);
    console.log(`🧩 PDF ${chunks.length} parçaya bölündü. Kayıt başlıyor...`);

    // 3. Vektöre Çevir ve Kaydet
    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await embeddingModel.embedContent(chunks[i]);
        const vector = result.embedding.values;
        
        await client.query(
          "INSERT INTO documents (content, embedding) VALUES ($1, $2)",
          [chunks[i], JSON.stringify(vector)]
        );
        successCount++;
        await sleep(500); // Google Rate Limit'e takılmamak için minik mola
      } catch (err) {
        console.error(`⚠️ Parça ${i+1} atlandı (Hata: ${err.message})`);
      }
    }

    res.json({ 
      message: "PDF başarıyla işlendi ve veritabanına kaydedildi.",
      fileName: req.file.originalname,
      totalChunksSaved: successCount 
    });

  } catch (error) {
    console.error("❌ Dosya İşleme Hatası:", error);
    res.status(500).json({ error: "PDF işlenirken bir hata oluştu: " + error.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 💬 ESKİ ENDPOINT: SOHBET (CHAT)
// ==========================================
app.post("/api/chat", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Soru eksik." });

  const client = await pool.connect();
  try {
    const embeddingResult = await embeddingModel.embedContent(question);
    const vectorStr = JSON.stringify(embeddingResult.embedding.values);

    const sql = `SELECT content, (embedding <=> $1) as distance FROM documents ORDER BY distance ASC LIMIT 3;`;
    const result = await client.query(sql, [vectorStr]);

    if (result.rows.length === 0) return res.json({ answer: "Veritabanında bilgi yok." });

    const context = result.rows.map(r => r.content).join("\n\n---\n\n");
    const prompt = `Aşağıdaki BİLGİLERİ kullanarak soruyu cevapla. Bilgilerde yoksa "Bilgim yok" de.\n\nBİLGİLER:\n${context}\n\nSORU:\n${question}`;

    const chatResult = await chatModel.generateContent(prompt);
    res.json({ answer: await chatResult.response.text()});
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 RAG API Sunucusu çalışıyor: http://localhost:${PORT}`);
});
