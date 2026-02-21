import { GoogleGenerativeAI } from "@google/generative-ai";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

// YENİ VERİTABANI BAĞLANTISI (Port 5433)
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://postgres:mysecretpassword@localhost:5433/yeni_vector_db",
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Veritabanına atacağımız test verileri
const testData = [
  "Yapay zeka (AI), insan zekasını taklit eden makinelerdir. Alan Turing tarafından temelleri atılmıştır.",
  "RAG (Retrieval-Augmented Generation) mimarisi, dil modellerine şirket içi belgeler gibi özel verileri öğreterek hafıza kazandırır.",
  "PostgreSQL ve pgvector eklentisi kullanılarak, metinlerin anlamsal karşılığı olan vektörler veritabanında saklanabilir.",
  "Gelecekte AI ajanları sadece sohbet etmeyecek, bizim adımıza otel rezervasyonu yapmak gibi işlemleri de halledecek."
];

async function setupDirect() {
  const client = await pool.connect();
  
  try {
    console.log("🛠️ 1. Veritabanı Hazırlanıyor...");
    // 3072 boyutlu vektör tablosunu oluştur
    await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        content TEXT,
        embedding vector(3072)
      );
    `);
    
    // Test için tabloyu temizleyelim (üst üste binmesin)
    await client.query("TRUNCATE TABLE documents;");
    console.log("✅ Tablo hazır ve temizlendi!");

    console.log("🚀 2. Metinler Vektörleştirilip Kaydediliyor...");

    for (let i = 0; i < testData.length; i++) {
      const text = testData[i];
      
      // Vektöre çevir
      const result = await model.embedContent(text);
      const vector = result.embedding.values;
      const vectorStr = JSON.stringify(vector);

      // Veritabanına kaydet
      const query = "INSERT INTO documents (content, embedding) VALUES ($1, $2)";
      await client.query(query, [text, vectorStr]);
      
      console.log(`✅ Kaydedildi: Parça ${i + 1}/${testData.length}`);
    }

    console.log("\n🎉 KURULUM BAŞARILI! Artık API sunucunu test edebilirsin.");

  } catch (err) {
    console.error("\n❌ Hata:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDirect();
