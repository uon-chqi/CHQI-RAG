import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webhookRoutes from './routes/webhooks.js';
import ragRoutes from './routes/rag.js';
import conversationRoutes from './routes/conversations.js';
import documentRoutes from './routes/documents.js';
import analyticsRoutes from './routes/analytics.js';
import healthRoutes from './routes/health.js';
import facilitiesRoutes from './routes/facilities.js';
import smsAdminRoutes from './routes/sms-admin.js';
import cronsRoutes from './routes/crons.js';
import patientsRoutes from './routes/patients.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import facilityRoutes from './routes/facility.js';
import { initDailySync } from './services/dailySync.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT) || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/rag', rateLimiter, ragRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', healthRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/sms-admin', smsAdminRoutes);
app.use('/api/crons', cronsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/facility', facilityRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// ── Serve frontend in production ────────────────────────────
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback: any non-API route serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Function to start server with retry logic
const startServer = (port) => {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Healthcare RAG Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
      // Close the server and try next port
      server.close();
      startServer(port + 1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  return server;
};

// Start the server
console.log(`🚀 Starting server...`);
startServer(DEFAULT_PORT);

// Initialize daily sync cron job (9 PM EAT)
initDailySync();