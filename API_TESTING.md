# API Testing Guide

Quick reference for testing all API endpoints.

## Base URL
```
http://localhost:3001
```

---

## 1. Test Webhooks

### SMS Webhook (Africa's Talking)
```bash
curl -X POST http://localhost:3001/api/webhooks/sms/receive \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+254712345678",
    "text": "What are the symptoms of diabetes?"
  }'
```

### WhatsApp Webhook (Twilio)
```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp/receive \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+254712345678",
    "Body": "How do I manage high blood pressure?"
  }'
```

---

## 2. RAG Query

### Process Medical Query
```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What medications are recommended for type 2 diabetes?",
    "phone": "+254712345678",
    "channel": "api"
  }'
```

---

## 3. Documents

### Upload Document
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@/path/to/medical-document.pdf" \
  -F "title=Diabetes Treatment Guidelines"
```

### List All Documents
```bash
curl http://localhost:3001/api/documents
```

### Get Single Document
```bash
curl http://localhost:3001/api/documents/{document-id}
```

### Delete Document
```bash
curl -X DELETE http://localhost:3001/api/documents/{document-id}
```

---

## 4. Conversations

### List Conversations
```bash
curl "http://localhost:3001/api/conversations?page=1&limit=20"
```

### Search by Phone
```bash
curl "http://localhost:3001/api/conversations?phone=254712345678"
```

### Filter by Channel
```bash
curl "http://localhost:3001/api/conversations?channel=sms"
```

### Get Single Conversation
```bash
curl http://localhost:3001/api/conversations/{conversation-id}
```

### Get Conversation History by Phone
```bash
curl http://localhost:3001/api/conversations/phone/+254712345678
```

---

## 5. Analytics

### Get Summary Statistics
```bash
curl http://localhost:3001/api/analytics/summary
```

### Get Daily Analytics
```bash
curl "http://localhost:3001/api/analytics/daily?startDate=2024-01-01&endDate=2024-12-31"
```

### Get Top Topics
```bash
curl http://localhost:3001/api/analytics/topics
```

### Get Channel Statistics
```bash
curl http://localhost:3001/api/analytics/channel-stats
```

---

## 6. System Health

### Check All Services
```bash
curl http://localhost:3001/api/system/health
```

### Get Error Logs
```bash
curl "http://localhost:3001/api/system/logs?limit=50"
```

### Basic Health Check
```bash
curl http://localhost:3001/api/health
```

---

## Example Responses

### Successful RAG Query
```json
{
  "success": true,
  "data": {
    "response": "Type 2 diabetes is commonly treated with medications such as Metformin, which helps control blood sugar levels. Always consult a healthcare professional for personalized treatment. [1]",
    "citations": [
      {
        "index": 1,
        "documentTitle": "Diabetes Treatment Guidelines",
        "documentId": "uuid-here",
        "score": 0.89,
        "text": "Metformin is the first-line medication for type 2 diabetes..."
      }
    ],
    "responseTime": 2341,
    "conversationId": "uuid-here"
  }
}
```

### Document List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "title": "Diabetes Treatment Guidelines",
      "file_name": "diabetes-guide.pdf",
      "file_type": "application/pdf",
      "total_chunks": 45,
      "status": "completed",
      "uploaded_at": "2024-02-06T10:30:00Z",
      "processed_at": "2024-02-06T10:32:15Z"
    }
  ]
}
```

### System Health Response
```json
{
  "success": true,
  "status": "healthy",
  "services": [
    {
      "name": "gemini",
      "status": "healthy",
      "responseTime": 234
    },
    {
      "name": "vector_db",
      "status": "healthy",
      "totalVectors": 1250
    },
    {
      "name": "sms",
      "status": "healthy"
    },
    {
      "name": "whatsapp",
      "status": "healthy"
    }
  ],
  "timestamp": "2024-02-06T14:25:00Z"
}
```

---

## Testing Workflow

### Complete Test Flow

1. **Check System Health**
```bash
curl http://localhost:3001/api/system/health
```

2. **Upload a Medical Document**
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@medical-doc.pdf" \
  -F "title=Medical Guidelines"
```

3. **Wait for Processing** (Check status)
```bash
curl http://localhost:3001/api/documents
```

4. **Send Test Query**
```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the recommended treatments?",
    "phone": "+254712345678",
    "channel": "api"
  }'
```

5. **Check Conversation History**
```bash
curl http://localhost:3001/api/conversations
```

6. **View Analytics**
```bash
curl http://localhost:3001/api/analytics/summary
curl http://localhost:3001/api/analytics/topics
```

---

## Rate Limiting

- **5 messages per minute** per phone number
- Applies to SMS, WhatsApp, and direct API queries
- Returns 429 status code when exceeded
- Resets after 60 seconds

Test rate limit:
```bash
# Send 6 messages quickly
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/webhooks/sms/receive \
    -H "Content-Type: application/json" \
    -d "{\"from\": \"+254712345678\", \"text\": \"Test $i\"}"
done
```

The 6th request should be rate limited.

---

## Error Responses

### Invalid Request
```json
{
  "success": false,
  "error": "Message and phone number are required"
}
```

### Rate Limited
```json
{
  "error": "Too many requests. Please try again in a minute.",
  "limit": 5,
  "window": "1 minute"
}
```

### Server Error
```json
{
  "success": false,
  "error": "Failed to process query"
}
```

---

## Postman Collection

Import this JSON into Postman for easy testing:

```json
{
  "info": {
    "name": "Healthcare RAG API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "RAG Query",
      "request": {
        "method": "POST",
        "url": "http://localhost:3001/api/rag/query",
        "body": {
          "mode": "raw",
          "raw": "{\"message\": \"What are diabetes symptoms?\", \"phone\": \"+254712345678\", \"channel\": \"api\"}"
        }
      }
    },
    {
      "name": "List Documents",
      "request": {
        "method": "GET",
        "url": "http://localhost:3001/api/documents"
      }
    },
    {
      "name": "List Conversations",
      "request": {
        "method": "GET",
        "url": "http://localhost:3001/api/conversations"
      }
    },
    {
      "name": "System Health",
      "request": {
        "method": "GET",
        "url": "http://localhost:3001/api/system/health"
      }
    }
  ]
}
```

---

## Testing Tips

1. **Start with health check** to ensure all services are running
2. **Upload a small document first** (1-2 pages) to test processing
3. **Use descriptive phone numbers** for testing (e.g., +254700000001, +254700000002)
4. **Check dashboard in browser** while testing APIs to see real-time updates
5. **Monitor server logs** for detailed error messages
6. **Test rate limiting** to ensure protection works
7. **Try edge cases** like empty messages, very long messages, etc.

---

## Debugging

### Enable Verbose Logging
```bash
# In server/index.js, add:
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});
```

### Check Pinecone Vectors
```bash
curl http://localhost:3001/api/system/health
# Look for totalVectors in vector_db service
```

### Test Gemini Directly
```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "phone": "+254700000000"}'
```

---

Happy Testing!
