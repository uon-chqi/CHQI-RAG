# Healthcare RAG System

A production-ready Healthcare RAG (Retrieval-Augmented Generation) system that enables patients to ask medical questions via SMS/WhatsApp and receive AI-powered responses based on uploaded medical documents.

## 🎯 What We've Built

This system uses **local embeddings** and **vector search** to retrieve relevant medical information from uploaded documents and generate intelligent, cited responses using AI.

### Current Features (Completed ✅)

- ✅ **Document Processing**: Upload PDF/DOCX medical documents
- ✅ **Local Embeddings**: Using Xenova/all-MiniLM-L6-v2 (no API rate limits)
- ✅ **Vector Storage**: PostgreSQL with pgvector extension
- ✅ **Semantic Search**: Find relevant information from 384-dimensional vectors
- ✅ **AI Responses**: Google Gemini 2.5 Flash for intelligent medical Q&A
- ✅ **Admin Dashboard**: Real-time monitoring and document management
- ✅ **Citation System**: Every response includes source references
- ✅ **Session Management**: Track patient interactions

### Coming Soon 🚀

- 🔜 **SMS Integration**: Africa's Talking API for SMS messaging
- 🔜 **WhatsApp Integration**: Twilio API for WhatsApp messaging
- 🔜 **Webhook Handlers**: Receive and respond to patient messages
- 🔜 **Rate Limiting**: 5 messages per minute per patient
- 🔜 **Real-time Updates**: Live message feed
- 🔜 **Multi-language Support**: Translation for local languages

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Admin Dashboard                       │
│          (Upload Documents, View Analytics)              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                  Express.js Backend                      │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │  Document    │  RAG Query   │  Analytics       │    │
│  │  Processor   │  Service     │  Service         │    │
│  └──────────────┴──────────────┴──────────────────┘    │
└────────┬────────────────┬────────────────────┬──────────┘
         │                │                    │
         ▼                ▼                    ▼
┌─────────────┐  ┌──────────────────┐  ┌─────────────┐
│  PDF/DOCX   │  │  Local Embedding │  │ PostgreSQL  │
│  Parsing    │  │  Model (384-dim) │  │ + pgvector  │
└─────────────┘  └──────────────────┘  └─────────────┘
         │                │                    │
         └────────────────┴────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Google Gemini   │
                 │  2.5 Flash      │
                 └─────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  AI Response    │
                 │  with Citations │
                 └─────────────────┘

Future: Patient → SMS/WhatsApp → Webhooks → RAG Engine
```

## 📁 Project Structure

```
project/
├── server/                          # Backend API
│   ├── index.js                     # Express server entry point
│   ├── config/
│   │   └── database.js              # PostgreSQL connection
│   ├── routes/
│   │   ├── documents.js             # Document upload/management
│   │   ├── rag.js                   # Query processing
│   │   ├── conversations.js         # Message history
│   │   ├── analytics.js             # Statistics
│   │   ├── health.js                # System health checks
│   │   └── webhooks.js              # SMS/WhatsApp webhooks (coming soon)
│   ├── services/
│   │   ├── documentProcessor.js     # PDF/DOCX parsing & chunking
│   │   ├── gemini.js                # Local embeddings + AI chat
│   │   ├── pgvector.js              # Vector storage & search
│   │   ├── rag.js                   # RAG orchestration
│   │   ├── sms.js                   # Africa's Talking (coming soon)
│   │   └── whatsapp.js              # Twilio WhatsApp (coming soon)
│   └── middleware/
│       ├── errorHandler.js          # Error handling
│       └── rateLimiter.js           # Rate limiting
├── src/                             # Frontend Dashboard
│   ├── pages/
│   │   ├── Dashboard.tsx            # Overview & stats
│   │   ├── Documents.tsx            # Document library
│   │   ├── Conversations.tsx        # Message history
│   │   ├── Analytics.tsx            # Charts & insights
│   │   ├── LiveMessages.tsx         # Real-time feed (coming soon)
│   │   └── SystemHealth.tsx         # Service monitoring
│   ├── components/
│   │   ├── Layout.tsx               # App layout
│   │   ├── MessageCard.tsx          # Message display
│   │   └── ui/                      # Reusable components
│   └── lib/
│       ├── api.ts                   # API client
│       └── utils.ts                 # Utilities
├── supabase/migrations/             # Database schema
├── .env                             # Environment variables
├── package.json                     # Dependencies
└── README.md                        # This file
```

## 🚀 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Aiven Cloud)
- **Vector Extension**: pgvector (384 dimensions)
- **Embeddings**: @xenova/transformers (all-MiniLM-L6-v2)
- **LLM**: Google Gemini 2.5 Flash
- **PDF Parsing**: pdf-parse
- **Document Processing**: mammoth (DOCX)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (Green-600 theme)
- **Routing**: React Router v6
- **HTTP Client**: Axios

### Future Integrations
- **SMS**: Africa's Talking API
- **WhatsApp**: Twilio API
- **Real-time**: WebSocket or Server-Sent Events

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create/edit `.env` file:

```env
# Database
DB_NAME=defaultdb
DB_HOST=your-postgres-host
DB_PORT=15219
DB_USER=avnadmin
DB_PASSWORD=your-password

# AI APIs
GEMINI_API_KEY=your-gemini-api-key
GEMINI_CHAT_MODEL=models/gemini-2.5-flash

# Future: Messaging APIs (not yet implemented)
AFRICASTALKING_API_KEY=your-africastalking-key
AFRICASTALKING_USERNAME=sandbox
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Server
PORT=5000
```

### 3. Setup Database

Run the migration to create tables and enable pgvector:

```bash
# Option 1: Using psql
psql -h your-host -p 15219 -U avnadmin -d defaultdb -f supabase/migrations/20260206065420_create_healthcare_rag_schema.sql

# Option 2: Using Node.js script
node update-vector-dimension.js
```

### 4. Run the Application

**Backend (Terminal 1):**
```bash
npm run server
```
API server at: http://localhost:5000

**Frontend (Terminal 2):**
```bash
npm run dev
```
Dashboard available at: http://localhost:5173

## 📚 How the RAG System Works

### 1. Document Upload & Processing

```javascript
// User uploads PDF/DOCX
→ parsePDF/parseDOCX extracts raw text
→ preprocessText cleans and normalizes
→ chunkText creates semantic chunks (500-1000 chars)
→ generateEmbedding creates 384-dim vectors (local model)
→ upsertVectors stores in PostgreSQL with pgvector
```

### 2. Query Processing

```javascript
// Patient asks: "What are HIV treatment guidelines?"
→ generateEmbedding converts query to 384-dim vector
→ queryVectors finds top 5 similar chunks (cosine similarity)
→ Chunks combined into context (with citations)
→ generateResponse sends to Gemini AI
→ AI generates response with source references
→ Response stored in conversations table
```

### 3. Key Components

**Local Embeddings** (`@xenova/transformers`)
- Model: `Xenova/all-MiniLM-L6-v2`
- Dimensions: 384
- No API calls, no rate limits
- Runs on CPU/GPU locally

**Vector Storage** (`pgvector`)
- PostgreSQL extension for vector similarity search
- Cosine distance operator: `<=>` 
- HNSW index for fast retrieval
- Stores text + metadata + embeddings

**Document Chunking**
- Splits text by paragraphs
- Target: 500-1000 characters per chunk
- Overlap: Last 2 sentences for context
- Filters out TOC, headers, page numbers

**AI Response Generation**
- Google Gemini 2.5 Flash
- System prompt with safety guidelines
- Context injection from retrieved chunks
- Temperature: 0.7 for balanced responses

## 🧪 Testing the System

### Test Document Upload

1. Go to http://localhost:5173/documents
2. Click "Choose Files" and upload a medical PDF
3. Wait for status to change from "Processing" to "Indexed"
4. Check chunks count (should show number like 365)

### Test RAG Query (Postman/cURL)

```bash
curl -X POST http://localhost:5000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the guidelines for HIV treatment?",
    "phone": "+254712345670"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "response": "HIV treatment guidelines aim to improve quality of life...",
    "citations": [
      {
        "index": 1,
        "documentTitle": "Medical Document",
        "documentId": "uuid-here",
        "score": 0.72,
        "text": "The current widespread availability of antiretroviral..."
      }
    ],
    "responseTime": 4500,
    "conversationId": "uuid-here"
  }
}
```

### Test SMS Webhook (Future)

```bash
# Once Africa's Talking is integrated
curl -X POST http://localhost:5000/api/webhooks/sms/receive \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+254700000000",
    "text": "What are diabetes symptoms?",
    "id": "msg-123"
  }'
```

## 📊 Database Schema

### Core Tables

**conversations** - Patient message logs
```sql
- id (UUID)
- patient_phone (VARCHAR)
- channel (sms/whatsapp)
- message (TEXT)
- response (TEXT)
- citations (JSONB)
- response_time_ms (INTEGER)
- status (pending/sent/error)
- created_at (TIMESTAMPTZ)
```

**documents** - Medical document metadata
```sql
- id (UUID)
- title (VARCHAR)
- file_name (VARCHAR)
- file_path (VARCHAR)
- file_type (VARCHAR)
- total_chunks (INTEGER)
- status (processing/completed/error)
- uploaded_at (TIMESTAMPTZ)
```

**document_vectors** - Vector embeddings
```sql
- id (UUID)
- document_id (UUID)
- chunk_index (INTEGER)
- content (TEXT)
- embedding (vector(384))  -- pgvector
- metadata (JSONB)
```

**sessions** - Patient session tracking
```sql
- id (UUID)
- patient_phone (VARCHAR)
- channel (VARCHAR)
- message_count (INTEGER)
- last_message_at (TIMESTAMPTZ)
- expires_at (TIMESTAMPTZ)
```

## 🔌 API Endpoints

### Documents
- `POST /api/documents/upload` - Upload PDF/DOCX
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document details
- `DELETE /api/documents/:id` - Delete document

### RAG Query
- `POST /api/rag/query` - Process patient question
  ```json
  {
    "message": "What are HIV symptoms?",
    "phone": "+254712345670"
  }
  ```

### Conversations
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/phone/:phoneNumber` - Get patient history

### Analytics
- `GET /api/analytics/summary` - System statistics
- `GET /api/analytics/topics` - Popular topics (future)

### System Health
- `GET /api/health` - Check all services

### Webhooks (Coming Soon)
- `POST /api/webhooks/sms/receive` - Africa's Talking SMS webhook
- `POST /api/webhooks/whatsapp/receive` - Twilio WhatsApp webhook

## 🎨 Dashboard Pages

1. **Dashboard** (`/`) - Overview with real-time stats
2. **Documents** (`/documents`) - Upload and manage medical PDFs
3. **Conversations** (`/conversations`) - View message history
4. **Analytics** (`/analytics`) - Charts and insights
5. **Live Messages** (`/live`) - Real-time feed (coming soon)
6. **System Health** (`/system`) - Service monitoring

## 🔐 Security & Best Practices

### Current Implementation
- ✅ Environment variables for secrets
- ✅ Input validation on all endpoints
- ✅ Error handling and logging
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting middleware ready

### Coming Soon
- 🔜 Authentication for admin dashboard
- 🔜 Phone number verification
- 🔜 Webhook signature verification
- 🔜 HTTPS enforcement
- 🔜 CORS configuration for production

## 🚧 Roadmap & Next Steps

### Phase 1: Core RAG ✅ (Completed)
- [x] Document upload and processing
- [x] PDF/DOCX text extraction
- [x] Semantic chunking
- [x] Local embedding generation
- [x] Vector storage with pgvector
- [x] Semantic search
- [x] AI response generation
- [x] Citation system
- [x] Admin dashboard

### Phase 2: Messaging Integration 🔜 (Next)
- [ ] Africa's Talking SMS setup
  - [ ] Account registration
  - [ ] Webhook configuration
  - [ ] Message sending
  - [ ] Delivery reports
- [ ] Twilio WhatsApp setup
  - [ ] Sandbox testing
  - [ ] Production approval
  - [ ] Media message support
- [ ] Rate limiting per phone number
- [ ] Session management
- [ ] Message queue for async processing

### Phase 3: Enhanced Features 🔮 (Future)
- [ ] Multi-language support (Swahili, etc.)
- [ ] Voice message support
- [ ] Image/document upload from patients
- [ ] Appointment scheduling
- [ ] Medication reminders
- [ ] Patient profiles
- [ ] Analytics dashboard improvements
- [ ] Export to CSV/PDF

## 🛠️ Development Tools

### Useful Scripts

```bash
# Start development server
npm run dev

# Start backend server
npm run server

# Run both concurrently
npm run dev & npm run server

# Database migration
node update-vector-dimension.js

# Test API endpoints
npm run test  # (add test script)
```

### Debugging

Check terminal logs for:
- `🔧 Loading local embedding model` - First time setup
- `✅ Local embedding model loaded` - Ready to process
- `📊 Found X relevant chunks` - Vector search results
- `🎯 Top match score: 0.72` - Similarity score (0-1)

## 📖 Additional Resources

- **Setup Guide**: `SETUP_GUIDE.md` (if exists)
- **API Testing**: `API_TESTING.md` (if exists)
- **Database Guide**: `VECTOR_DATABASE_GUIDE.md`
- **PostgreSQL Setup**: `POSTGRESQL_SETUP.md`
4. **Document Library**: Upload and manage medical documents
5. **Analytics**: Charts and insights
6. **System Health**: Monitor all services

## Testing

### Test Document Upload
1. Go to Document Library at http://localhost:5173/documents
2. Upload a medical PDF/DOCX
3. Wait for processing (status changes to "Indexed")
4. Check chunks count

### Test RAG Query (Current Implementation)
```bash
curl -X POST http://localhost:5000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the guidelines for HIV treatment?",
    "phone": "+254712345670"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "HIV treatment guidelines aim to improve quality of life...",
    "citations": [...],
    "responseTime": 4500
  }
}
```

### Test SMS (Coming Soon)
```bash
# Will be implemented with Africa's Talking
curl -X POST http://localhost:5000/api/webhooks/sms/receive \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+254700000000",
    "text": "What are diabetes symptoms?",
    "id": "ATXid_123456"
  }'
```

### Test WhatsApp (Coming Soon)
```bash
# Will be implemented with Twilio
curl -X POST http://localhost:5000/api/webhooks/whatsapp/receive \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+254700000000",
    "Body": "How to manage blood pressure?",
    "MessageSid": "SM123456"
  }'
```

## 🤝 Contributing

This project is open for improvements! Areas to contribute:
- SMS/WhatsApp integration implementation
- Multi-language support
- Additional document formats
- Enhanced analytics
- Performance optimizations
- Security enhancements
- Test coverage

## 📝 License

MIT License - Open source and free to use

## 💡 About This Project

Built as a healthcare RAG system to provide accessible medical information to patients via messaging platforms. The system uses local embeddings to eliminate API rate limits and costs while maintaining high-quality semantic search capabilities.

**Key Innovation**: Using `@xenova/transformers` for local embeddings means unlimited document processing and queries without external API dependencies (except for AI response generation).

---

**Stack**: React + TypeScript + Express + PostgreSQL + pgvector + Transformers.js + Google Gemini  
**Status**: Core RAG ✅ | SMS Integration 🔜 | WhatsApp Integration 🔜  
**Author**: Healthcare RAG Team  
**Last Updated**: February 8, 2026
