# Healthcare RAG System - Complete Setup Guide

A full-stack Healthcare RAG (Retrieval-Augmented Generation) system that allows patients to ask medical questions via SMS/WhatsApp and receive AI-powered responses based on medical documents.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Running the Application](#running-the-application)
5. [Testing the System](#testing-the-system)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Patient → SMS/WhatsApp → Webhooks → RAG System → Gemini AI → Response → Patient
                                         ↓
                                   Vector Database
                                   (Pinecone/Qdrant)
                                         ↓
                                Medical Documents
```

**Components:**
- **Backend**: Express.js server with REST APIs
- **Frontend**: React dashboard with green-600 theme
- **Database**: Supabase PostgreSQL (conversation logs, documents, analytics)
- **Vector DB**: Pinecone (document embeddings)
- **LLM**: Google Gemini 1.5 Pro
- **Messaging**: Africa's Talking (SMS) + Twilio (WhatsApp)

---

## Prerequisites

Before you begin, create accounts and get API keys for the following services:

### 1. Google Gemini API
- Visit: https://makersuite.google.com/app/apikey
- Sign in with your Google account
- Click "Create API key"
- Copy the API key

### 2. Pinecone (Vector Database)
- Visit: https://www.pinecone.io/
- Sign up for a free account
- Create a new index:
  - **Name**: `medical-documents`
  - **Dimensions**: `768`
  - **Metric**: `cosine`
- Go to API Keys section and copy:
  - API Key
  - Environment

### 3. Africa's Talking (SMS)
- Visit: https://africastalking.com/
- Sign up for an account
- Go to Sandbox
- Copy:
  - API Key
  - Username (usually "sandbox")

### 4. Twilio (WhatsApp)
- Visit: https://www.twilio.com/
- Sign up for an account
- Get:
  - Account SID
  - Auth Token
- Enable WhatsApp Sandbox:
  - Go to Messaging > Try it out > Send a WhatsApp message
  - Follow instructions to connect your WhatsApp
  - Copy the sandbox number (e.g., `whatsapp:+14155238886`)

---

## Step-by-Step Setup

### Step 1: Configure Environment Variables

Open the `.env` file and replace the placeholder values with your actual API keys:

```env
# Supabase (Already configured)
VITE_SUPABASE_URL=https://lyhgsgwnxakmxwoofdhp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

SUPABASE_URL=https://lyhgsgwnxakmxwoofdhp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google Gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Pinecone Vector Database
PINECONE_API_KEY=YOUR_PINECONE_API_KEY_HERE
PINECONE_ENVIRONMENT=YOUR_PINECONE_ENVIRONMENT_HERE
PINECONE_INDEX_NAME=medical-documents

# Africa's Talking SMS
AFRICASTALKING_API_KEY=YOUR_AFRICASTALKING_API_KEY_HERE
AFRICASTALKING_USERNAME=sandbox

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID_HERE
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN_HERE
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Server Port
PORT=3001
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages for both frontend and backend.

### Step 3: Database Setup

The database is already set up in Supabase with the following tables:
- `conversations` - Stores all SMS/WhatsApp messages and responses
- `documents` - Tracks uploaded medical documents
- `sessions` - Manages user sessions
- `analytics_daily` - Daily usage statistics
- `system_health` - Service health monitoring

No additional setup needed!

### Step 4: Deploy Webhooks (Production Only)

For production, you need to expose your server to the internet for webhooks:

**Option A: Using ngrok (for testing)**
```bash
# Install ngrok
npm install -g ngrok

# Run ngrok
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

**Option B: Deploy to a server (recommended for production)**
- Deploy to Heroku, Railway, Render, or any VPS
- Get your public URL

**Configure Webhooks:**

1. **Africa's Talking:**
   - Go to your Africa's Talking dashboard
   - Navigate to SMS > Callback URLs
   - Set Incoming Messages URL to: `https://your-domain.com/api/webhooks/sms/receive`

2. **Twilio:**
   - Go to Twilio Console > Messaging > Settings > WhatsApp Sandbox
   - Set "When a message comes in" to: `https://your-domain.com/api/webhooks/whatsapp/receive`

---

## Running the Application

### Development Mode

You need to run both the frontend and backend:

**Terminal 1 - Frontend:**
```bash
npm run dev
```
This starts the React dashboard at `http://localhost:5173`

**Terminal 2 - Backend:**
```bash
npm run server
```
This starts the Express server at `http://localhost:3001`

### Production Build

```bash
npm run build
npm run preview
```

---

## Testing the System

### 1. Test Document Upload

1. Open the dashboard at `http://localhost:5173`
2. Navigate to "Document Library"
3. Upload a medical PDF or DOCX file (e.g., diabetes guidelines, medication info)
4. Enter a title (e.g., "Diabetes Treatment Guidelines")
5. Click "Upload Document"
6. Wait for processing to complete (status will change to "completed")

### 2. Test SMS (Africa's Talking Sandbox)

**Send a test SMS:**

```bash
curl -X POST http://localhost:3001/api/webhooks/sms/receive \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+254700000000",
    "text": "What are the symptoms of diabetes?"
  }'
```

Check the dashboard:
- Go to "Live Messages" to see the message appear in real-time
- Check "Conversation History" for the full exchange

### 3. Test WhatsApp (Twilio Sandbox)

1. Join the Twilio WhatsApp Sandbox first (send the join code via WhatsApp)
2. Send a message to the sandbox number
3. The system will process it and respond automatically

**Or test via API:**

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp/receive \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+254700000000",
    "Body": "How do I manage high blood pressure?"
  }'
```

### 4. Test RAG Query Directly

```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What medications are recommended for diabetes?",
    "phone": "+254700000000",
    "channel": "api"
  }'
```

### 5. Check System Health

1. Open dashboard at `http://localhost:5173`
2. Navigate to "System Health"
3. Click "Refresh" to check all services
4. All services should show "HEALTHY" status

---

## Dashboard Features

### 1. Dashboard Overview
- Real-time statistics (messages today, this week)
- Average response time
- Error count
- Recent message feed

### 2. Live Messages
- Real-time message stream with auto-updates
- See patient messages and AI responses as they happen
- Status indicators (sent, error, pending)

### 3. Conversation History
- Search conversations by phone number
- Filter by channel (SMS/WhatsApp)
- Export to CSV
- Full message threads

### 4. Document Library
- Upload medical documents (PDF/DOCX)
- View processing status
- Delete documents
- Track chunk counts

### 5. Analytics
- Top medical topics chart
- Channel distribution (SMS vs WhatsApp)
- Query breakdown with percentages

### 6. System Health
- Service status monitoring
- Response time tracking
- Error logging
- System requirements checklist

---

## Troubleshooting

### Issue: "Pinecone connection failed"

**Solution:**
- Check your `PINECONE_API_KEY` in `.env`
- Verify your index name is `medical-documents`
- Ensure the index dimension is `768`
- Check that the index exists in your Pinecone dashboard

### Issue: "Gemini API error"

**Solution:**
- Verify your `GEMINI_API_KEY` is correct
- Check if you've exceeded the free tier limits
- Ensure the API key has permissions for both embedding and generation

### Issue: "Document processing stuck"

**Solution:**
- Check server logs for errors
- Ensure the PDF/DOCX file is not corrupted
- Try a smaller file first (under 5MB)
- Verify Pinecone connection is working

### Issue: "SMS/WhatsApp not receiving messages"

**Solution:**
- Ensure your server is publicly accessible (use ngrok for testing)
- Verify webhook URLs are correctly configured
- Check API credentials in `.env`
- Look at server logs for webhook errors

### Issue: "Frontend can't connect to backend"

**Solution:**
- Ensure backend server is running on port 3001
- Check that CORS is enabled (already configured)
- Verify API URLs in frontend code use `http://localhost:3001`

### Issue: "Rate limit exceeded"

**Solution:**
- The system allows 5 messages per minute per user
- Wait 60 seconds before sending another message
- This is configurable in `server/middleware/rateLimiter.js`

---

## API Endpoints Reference

### Webhooks
- `POST /api/webhooks/sms/receive` - Receive SMS messages
- `POST /api/webhooks/whatsapp/receive` - Receive WhatsApp messages

### RAG System
- `POST /api/rag/query` - Process a query directly

### Documents
- `POST /api/documents/upload` - Upload a document
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document details
- `DELETE /api/documents/:id` - Delete a document

### Conversations
- `GET /api/conversations` - List conversations (with pagination)
- `GET /api/conversations/:id` - Get single conversation
- `GET /api/conversations/phone/:phoneNumber` - Get conversation history

### Analytics
- `GET /api/analytics/daily` - Daily statistics
- `GET /api/analytics/summary` - Summary statistics
- `GET /api/analytics/topics` - Popular topics
- `GET /api/analytics/channel-stats` - Channel distribution

### System Health
- `GET /api/system/health` - Check all services
- `GET /api/system/logs` - Get error logs

---

## Project Structure

```
project/
├── server/                 # Backend Express server
│   ├── index.js           # Main server file
│   ├── config/            # Configuration files
│   ├── services/          # Service integrations
│   │   ├── gemini.js      # Google Gemini AI
│   │   ├── pinecone.js    # Vector database
│   │   ├── sms.js         # Africa's Talking
│   │   ├── whatsapp.js    # Twilio WhatsApp
│   │   ├── rag.js         # RAG query processing
│   │   └── documentProcessor.js
│   ├── routes/            # API routes
│   └── middleware/        # Express middleware
├── src/                   # Frontend React app
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── lib/              # Utilities
│   └── App.tsx           # Main app component
└── .env                  # Environment variables
```

---

## Security Best Practices

1. Never commit `.env` file to Git
2. Use environment variables for all API keys
3. Enable rate limiting (already configured)
4. Implement proper authentication for admin dashboard (TODO)
5. Use HTTPS in production
6. Regularly rotate API keys
7. Monitor error logs for security issues
8. Keep dependencies updated

---

## Next Steps

1. Add authentication to the admin dashboard
2. Implement email notifications for errors
3. Add more analytics charts
4. Implement patient feedback system
5. Add support for voice messages
6. Create mobile app for patients
7. Implement multi-language support
8. Add appointment scheduling

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Check the System Health page in the dashboard
4. Verify all API keys are correct

---

## License

MIT License - Feel free to use this for your healthcare projects!
