# Healthcare RAG System

A production-ready Healthcare RAG (Retrieval-Augmented Generation) system that enables patients to ask medical questions via SMS/WhatsApp and receive AI-powered responses based on medical documents.

## Features

- **Multi-Channel Support**: SMS (Africa's Talking) and WhatsApp (Twilio)
- **Document Ingestion**: Upload and process medical PDFs/DOCX files
- **Vector Search**: Powered by Pinecone for semantic document retrieval
- **AI Responses**: Google Gemini 1.5 Pro for intelligent medical Q&A
- **Admin Dashboard**: Real-time monitoring and analytics
- **Rate Limiting**: 5 messages per minute per patient
- **Session Management**: Track patient interactions
- **Real-time Updates**: Live message feed using Supabase subscriptions

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Vector DB**: Pinecone
- **LLM**: Google Gemini 1.5 Pro
- **Messaging**: Africa's Talking + Twilio

### Frontend
- **Framework**: React + TypeScript
- **Styling**: Tailwind CSS (Green-600 theme)
- **Charts**: Recharts
- **Routing**: React Router
- **State**: Supabase Real-time subscriptions

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Edit `.env` file with your API keys:
- Google Gemini API Key
- Pinecone API Key
- Africa's Talking credentials
- Twilio credentials

See `SETUP_GUIDE.md` for detailed instructions.

### 3. Run the Application

**Frontend (Terminal 1):**
```bash
npm run dev
```
Dashboard available at: http://localhost:5173

**Backend (Terminal 2):**
```bash
npm run server
```
API server at: http://localhost:3001

## Database Schema

Already configured in Supabase:

- **conversations** - SMS/WhatsApp message logs
- **documents** - Medical document metadata
- **sessions** - Patient session tracking
- **analytics_daily** - Daily statistics
- **system_health** - Service monitoring

## API Endpoints

### Webhooks
- `POST /api/webhooks/sms/receive` - Receive SMS
- `POST /api/webhooks/whatsapp/receive` - Receive WhatsApp

### Documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `DELETE /api/documents/:id` - Delete document

### Conversations
- `GET /api/conversations` - List conversations
- `GET /api/conversations/phone/:phoneNumber` - Get history

### Analytics
- `GET /api/analytics/summary` - Statistics
- `GET /api/analytics/topics` - Popular topics

### System
- `GET /api/system/health` - Check service health

## Dashboard Pages

1. **Dashboard Overview**: Real-time stats and recent messages
2. **Live Messages**: Real-time message feed
3. **Conversation History**: Search and export conversations
4. **Document Library**: Upload and manage medical documents
5. **Analytics**: Charts and insights
6. **System Health**: Monitor all services

## Testing

### Test Document Upload
1. Go to Document Library
2. Upload a medical PDF/DOCX
3. Wait for processing (check status)

### Test SMS (Simulate)
```bash
curl -X POST http://localhost:3001/api/webhooks/sms/receive \
  -H "Content-Type: application/json" \
  -d '{"from": "+254700000000", "text": "What are diabetes symptoms?"}'
```

### Test RAG Query
```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"message": "How to manage diabetes?", "phone": "+254700000000"}'
```

## Documentation

- **Full Setup Guide**: See `SETUP_GUIDE.md`
- **API Reference**: Included in setup guide
- **Troubleshooting**: Check setup guide

## Architecture

```
Patient → SMS/WhatsApp → Webhooks → RAG Engine → Gemini AI
                                         ↓
                                   Vector Search
                                   (Pinecone)
                                         ↓
                                Medical Documents
                                         ↓
                              Response → Patient
```

## Key Features Explained

### RAG Pipeline
1. Document is uploaded (PDF/DOCX)
2. Text is extracted and chunked (500-1000 tokens)
3. Embeddings generated using Gemini
4. Vectors stored in Pinecone with metadata
5. Patient query → Generate embedding
6. Similarity search retrieves top 5 chunks
7. Context + query sent to Gemini
8. Safe, cited response generated
9. Response sent via SMS/WhatsApp

### Safety Features
- Rate limiting (5 messages/minute)
- Safety checks on AI responses
- Emergency disclaimer
- Source citations
- Error logging and monitoring

## Environment Variables Required

```env
GEMINI_API_KEY=
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
AFRICASTALKING_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

## Production Deployment

1. Deploy backend to Heroku/Railway/Render
2. Configure webhook URLs in Africa's Talking and Twilio
3. Deploy frontend to Vercel/Netlify
4. Update CORS settings
5. Enable HTTPS
6. Set up monitoring

## Security Considerations

- All API keys in environment variables
- Rate limiting enabled
- Input validation
- Error handling
- Secure webhook endpoints
- Phone number masking in UI

## Contributing

This is a complete healthcare RAG system ready for production use. Feel free to:
- Add more integrations
- Improve the AI prompts
- Add authentication
- Enhance analytics
- Add more document types

## License

MIT License - Open source and free to use

## Support

For detailed setup instructions, see `SETUP_GUIDE.md`

---

Built with React, Express, Supabase, Pinecone, and Google Gemini
