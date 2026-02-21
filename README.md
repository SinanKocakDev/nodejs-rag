# Node.js RAG (Retrieval-Augmented Generation) API 🚀

Bu proje, Node.js ve Express.js kullanılarak geliştirilmiş bir Yapay Zeka (AI) destekli REST API'dir. Kullanıcıların PDF dosyalarını yüklemesine, bu dosyaların parçalanıp vektörleştirilmesine ve anlamsal arama (Semantic Search) yapılarak dosya içeriği hakkında sorular sorulmasına olanak tanır.

## 🌟 Özellikler
- **Dinamik Çevre Değişkenleri:** API anahtarları, model isimleri ve veritabanı ayarları tamamen `.env` üzerinden yönetilir.
- **PDF Yükleme ve İşleme:** `multer` ve `pdf-extraction` ile bellek (RAM) üzerinden hızlı PDF okuma.
- **Akıllı Parçalama (Chunking):** Metinleri bağlam kopmadan anlamlı parçalara (1000 karakter, 100 karakter overlap) bölme.
- **Vektörleştirme (Embeddings):** Google Gemini modelleri ile metinleri 3072 boyutlu vektörlere çevirme.
- **Vektör Veritabanı:** PostgreSQL ve `pgvector` eklentisi kullanılarak anlamsal (Cosine Distance) arama.
- **AI Chatbot:** Gemini AI ile sadece veritabanındaki (PDF) bağlama dayanarak halüsinasyon yapmadan cevap üretme.

## 🛠️ Kullanılan Teknolojiler
- **Backend:** Node.js, Express.js
- **Veritabanı:** PostgreSQL + pgvector eklentisi
- **Yapay Zeka:** Google Generative AI (Gemini) SDK
- **Diğer Kütüphaneler:** `pg`, `cors`, `dotenv`, `multer`, `pdf-extraction`

## ⚙️ Kurulum ve Çalıştırma

### 1. Gereksinimler
- Node.js (v18+)
- Docker (Veritabanı için)
- Google Gemini API Anahtarı

### 2. Veritabanını Ayağa Kaldırma (Docker)
PgVector destekli PostgreSQL veritabanını başlatmak için şu komutu kullanın:
\`\`\`bash
docker run --name pgvector-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=mysecretpassword -e POSTGRES_DB=yeni_vector_db -p 5433:5432 -d ankane/pgvector:latest
\`\`\`

### 3. Projeyi Klonlama ve Paketleri Yükleme
\`\`\`bash
git clone <SENIN_REPO_URL_ADRESIN>
cd <PROJE_KLASOR_ADI>
npm install
\`\`\`

### 4. Çevre Değişkenleri (.env)
Proje kök dizininde bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri kendi sisteminize göre doldurun:

\`\`\`env
# Sunucu Ayarları
PORT=3000

# Veritabanı Bağlantısı
DB_URI=postgresql://postgres:mysecretpassword@localhost:5433/yeni_vector_db

# Google Gemini Ayarları
GEMINI_API_KEY=sizin_google_gemini_api_anahtariniz_buraya
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_MODEL=gemini-1.5-flash
\`\`\`
*(Not: `gemini-1.5-flash` yerine hesabınızda aktif olan `gemini-pro` modelini de kullanabilirsiniz).*

### 5. Sunucuyu Başlatma
\`\`\`bash
node server.js
\`\`\`
Sunucu \`http://localhost:3000\` adresinde çalışmaya başlayacaktır.

## 🔌 API Kullanımı (Endpoints)

### 1. PDF Yükleme
- **URL:** `POST /api/upload`
- **Body (form-data):** `document` key'i ile bir PDF dosyası seçin.
- **HTTPie Örneği:**
  \`\`\`bash
  http -f POST http://localhost:3000/api/upload document@./dosya.pdf
  \`\`\`
- **Açıklama:** PDF'i bellekte okur, chunk'lara böler, vektörleştirir ve PostgreSQL'e kaydeder. Limitlere takılmamak için işlem sırasında minik gecikmeler (sleep) uygular.

### 2. Soru Sorma
- **URL:** `POST /api/chat`
- **Body (JSON):** 
  \`\`\`json
  {
    "question": "RAG mimarisi nedir?"
  }
  \`\`\`
- **HTTPie Örneği:**
  \`\`\`bash
  http POST http://localhost:3000/api/chat question="RAG mimarisi nedir?"
  \`\`\`
- **Açıklama:** Soruyu vektöre çevirir, DB'de en yakın bağlamı bulur ve AI aracılığıyla cevap üretir.
