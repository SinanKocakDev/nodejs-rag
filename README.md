# Node.js RAG & AI Agent API 🚀

Bu proje, Node.js ve Express.js kullanılarak geliştirilmiş, **Sürekli Hafıza (Chat History)** ve **Gerçek Zamanlı Akış (Streaming)** özelliklerine sahip gelişmiş bir RAG (Retrieval-Augmented Generation) REST API'dir.

Kullanıcıların kendi PDF dosyalarını yüklemesine, anlamsal arama (Semantic Search) yapmasına ve Google Gemini AI modeli ile veritabanındaki belgelere dayanarak gerçek zamanlı sohbet etmesine olanak tanır.

## 🌟 Öne Çıkan Özellikler

- **Sürekli Hafıza (Session History):** API "amnezi" hastası değildir. `sessionId` bazlı oturum yönetimi sayesinde kullanıcıların önceki sorularını hatırlar ve bağlamı koparmadan sohbeti sürdürür.
- **Gerçek Zamanlı Akış (Server-Sent Events / Streaming):** ChatGPT benzeri bir deneyim için, AI'ın ürettiği cevaplar tamamlanması beklenmeden kelime kelime frontend'e akıtılır (`res.write`).
- **Dinamik PDF Yükleme:** Kullanıcılar API üzerinden PDF yükleyebilir (`multer` ile RAM'de işleme). Yüklenen belgeler anında parçalanır (Chunking) ve vektörleştirilir.
- **Akıllı Parçalama (Chunking):** Metinler bağlam kopmadan 1000 karakterlik parçalara ve 100 karakterlik örtüşmelere (overlap) bölünür.
- **Vektör Veritabanı:** PostgreSQL + `pgvector` kullanılarak 3072 boyutlu vektörler üzerinde yüksek performanslı anlamsal (Cosine Distance) aramalar yapılır.

## 🛠️ Kullanılan Teknolojiler

- **Backend:** Node.js, Express.js
- **Veritabanı:** PostgreSQL, pgvector eklentisi
- **Yapay Zeka:** Google Generative AI (Gemini SDK)
- **Kütüphaneler:** `pg`, `cors`, `dotenv`, `multer`, `pdf-extraction`

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
Proje kök dizininde bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri doldurun:
\`\`\`env
PORT=3000
DB_URI=postgresql://postgres:mysecretpassword@localhost:5433/yeni_vector_db
GEMINI_API_KEY=sizin_google_gemini_api_anahtariniz
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_MODEL=gemini-1.5-flash
\`\`\`

### 5. Veritabanı Tablosunu Oluşturma
Sistemin çalışması için ilk önce `documents` tablosunun ve `vector` eklentisinin oluşturulması gerekir. Bunun için projedeki kurulum scriptini bir kez çalıştırın:
*(Not: Repo'da `setup_db_direct.js` veya benzeri bir scriptiniz varsa adını buraya yazın)*
\`\`\`bash
node setup_db_direct.js 
\`\`\`

### 6. Sunucuyu Başlatma
\`\`\`bash
node server.js
\`\`\`

---

## 🔌 API Kullanımı (Endpoints)

### 1. PDF Yükleme
Belgeleri anında veritabanına indekslemek için kullanılır.
- **URL:** `POST /api/upload`
- **Body (form-data):** `document` key'i ile bir PDF dosyası seçin.
- **HTTPie CLI Örneği:**
  \`\`\`bash
  http -f POST http://localhost:3000/api/upload document@./dosya.pdf
  \`\`\`

### 2. Sohbet Etme (Streaming & History)
Veritabanındaki belgelere dayanarak AI ile konuşmak içindir. `sessionId` göndererek sohbetin hatırlanmasını sağlayabilirsiniz. Cevaplar **SSE (Server-Sent Events)** formatında stream olarak döner.
- **URL:** `POST /api/chat`
- **Body (JSON):** 
  \`\`\`json
  {
    "question": "Alan Turing kimdir?",
    "sessionId": "user_123"
  }
  \`\`\`
- **cURL Örneği (Akışı Canlı İzlemek İçin):**
  \`\`\`bash
  curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Alan Turing kimdir?", "sessionId": "user_123"}'
  \`\`\`

### 3. Hafızayı Silme
Belirli bir oturumun (session) sohbet geçmişini bellekten temizler.
- **URL:** `DELETE /api/chat/:sessionId`
- **HTTPie Örneği:**
  \`\`\`bash
  http DELETE http://localhost:3000/api/chat/user_123
  \`\`\`
