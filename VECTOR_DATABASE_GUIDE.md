# Vector Database (pgvector) - How It Works

## 🎯 What is the Vector Database?

The **Vector Database** stores mathematical representations (embeddings) of your medical documents. It's the core of the RAG (Retrieval-Augmented Generation) system.

## 📊 Architecture Flow

```
Patient Question
    ↓
Convert to Embedding (1024-dim vector)
    ↓
Search Vector DB for Similar Chunks
    ↓
Retrieve Top 5 Most Relevant Chunks
    ↓
Send to Gemini LLM as Context
    ↓
Generate Medical Response
```

## 🔧 Current Setup

- **Vector DB**: PostgreSQL + pgvector extension
- **Embedding Model**: Cohere `embed-english-v3.0`
- **Dimensions**: 1024 (each chunk = array of 1024 numbers)
- **Similarity Search**: Cosine similarity with HNSW index
- **Storage**: `document_vectors` table in PostgreSQL

## 📁 Key Files

### 1. **server/services/pgvector.js**
   - `initPgVector()` - Initialize connection and check stats
   - `upsertVectors()` - Store document embeddings
   - `queryVectors()` - Search for similar chunks
   - `deleteVectorsByDocument()` - Remove document vectors

### 2. **server/services/rag.js**
   - `processQuery()` - Main RAG query pipeline
   - Steps:
     1. Generate query embedding
     2. Search vector DB for similar chunks
     3. Build context from relevant chunks
     4. Generate AI response
     5. Store conversation in database

### 3. **server/routes/rag.js**
   - `POST /api/rag/query` - API endpoint for queries

## ⚠️ Critical Issues Found

### Issue 1: **Dimension Mismatch** ✅ FIXED
- **Problem**: pgvector was configured for 768 dimensions (Gemini)
- **Reality**: Cohere embeddings are 1024 dimensions
- **Solution**: Updated `EMBEDDING_DIMENSIONS` to 1024
- **Action Needed**: Run [fix-vectors.sql](fix-vectors.sql) to update database

### Issue 2: **Rate Limiting** ✅ FIXED
- **Problem**: Cohere FREE tier has 100K tokens/minute limit
- **Symptom**: "trial token rate limit exceeded" errors
- **Solution**: 
  - Reduced batch size from 96 to 30 texts
  - Added 2-second delay between batches
  - Added auto-retry with 60-second wait on rate limits

### Issue 3: **Incomplete Documents**
- **Problem**: Recent upload has 964 chunks but 0 vectors (rate limit failed)
- **Status**: Document marked "completed" but unusable
- **Solution**: Run cleanup script to delete and re-upload

## 🚀 Next Steps

### Step 1: Fix Database Schema
```sql
-- Run this in DBeaver or database tool:
\i c:\Users\kipng\Downloads\rag\project\fix-vectors.sql
```

Or manually execute:
```sql
ALTER TABLE document_vectors ALTER COLUMN embedding TYPE vector(1024);
DELETE FROM documents WHERE status != 'completed' OR total_chunks = 0;
DELETE FROM document_vectors;
```

### Step 2: Restart Server
The new rate-limiting code needs the server restarted:
```
Kill current server (Ctrl+C)
cd c:\Users\kipng\Downloads\rag\project\server
npm run server
```

### Step 3: Re-upload Documents
- All existing documents need to be re-uploaded
- New uploads will:
  - Use correct 1024 dimensions
  - Respect rate limits (slower but reliable)
  - Actually store vectors properly

### Step 4: Test RAG Query
Once documents are indexed with vectors, test the query endpoint:

**Using Thunder Client / Postman:**
```http
POST http://localhost:3001/api/rag/query
Content-Type: application/json

{
  "message": "What are the symptoms of malaria?",
  "phone": "+254700000000",
  "channel": "api"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "response": "According to medical guidelines [1], malaria symptoms include...",
    "citations": [
      {
        "index": 1,
        "documentTitle": "WHO Guidelines",
        "documentId": "...",
        "score": 0.89,
        "text": "Relevant chunk preview..."
      }
    ],
    "responseTime": 1234,
    "conversationId": "..."
  }
}
```

### Step 5: Check Vector Storage
After re-uploading, verify vectors are stored:
```sql
SELECT 
  d.title,
  d.total_chunks,
  COUNT(dv.id) as vectors_count
FROM documents d
LEFT JOIN document_vectors dv ON dv.document_id = d.id
GROUP BY d.id, d.title, d.total_chunks;
```

Should show: `total_chunks = vectors_count` for each document

## 🔍 How to Debug

### Check Vector Count
```sql
SELECT COUNT(*) as total_vectors,
       COUNT(DISTINCT document_id) as unique_documents
FROM document_vectors;
```

### Test Similarity Search
```sql
-- This queries using a dummy vector (replace with actual embedding)
SELECT 
  content,
  1 - (embedding <=> '[0.1,0.2,...]'::vector) as similarity
FROM document_vectors
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 5;
```

### Check Conversations
```sql
SELECT 
  patient_phone,
  message,
  response,
  citations,
  response_time_ms,
  status
FROM conversations
ORDER BY created_at DESC
LIMIT 10;
```

## 📈 Performance Metrics

### Current Status
- **Vectors stored**: 0 (all cleared due to dimension mismatch)
- **Documents indexed**: 5 completed (but no usable vectors)
- **Embedding speed**: ~30 chunks per 2 seconds (rate-limited)
- **Query response**: Should be <2 seconds once vectors exist

### Expected After Fix
- **Upload time**: ~2-3 minutes per 1000 chunks (with rate limiting)
- **Query time**: <500ms for vector search, +1-2s for AI response
- **Accuracy**: Top-5 retrieval should find relevant chunks

## 🎓 Understanding Embeddings

**What is an embedding?**
- Text → Array of 1024 numbers
- Similar meanings → Similar numbers
- Example: 
  - "fever symptoms" = [0.23, 0.89, -0.12, ...]
  - "temperature elevation" = [0.25, 0.87, -0.10, ...] (very similar!)
  - "database connection" = [-0.78, 0.12, 0.56, ...] (very different)

**Why 1024 dimensions?**
- More dimensions = more nuanced meaning representation
- Cohere's model trained to output exactly 1024 dimensions
- Cannot mix different dimension sizes!

## ✅ Success Criteria

You'll know the Vector DB is working when:

1. ✅ Documents upload without rate limit errors (slower is OK)
2. ✅ `document_vectors` table has rows matching `total_chunks`
3. ✅ Query endpoint returns relevant responses with citations
4. ✅ `conversations` table stores query history
5. ✅ Server logs show vector search happening

## 🔗 Next Phase: SMS/WhatsApp Integration

Once Vector DB is confirmed working:
1. Set up Twilio/Africa's Talking accounts
2. Configure webhook endpoints
3. Test end-to-end patient queries via SMS
4. Monitor analytics dashboard

---

**Status**: 🟡 In Progress - Database schema fix needed, then re-upload documents
