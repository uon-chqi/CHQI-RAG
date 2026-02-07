import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhooks.js';
import ragRoutes from './routes/rag.js';
import conversationRoutes from './routes/conversations.js';
import documentRoutes from './routes/documents.js';
import analyticsRoutes from './routes/analytics.js';
import healthRoutes from './routes/health.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initPgVector } from './services/pgvector.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/webhooks', webhookRoutes);
app.use('/api/rag', rateLimiter, ragRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', healthRoutes);

app.use(errorHandler);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`🏥 Healthcare RAG Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  
  // Initialize pgvector
  try {
    await initPgVector();
  } catch (error) {
    console.error('Failed to initialize pgvector:', error.message);
  }
});
