import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
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
import countyRoutes from './routes/county.js';
import rescheduleRoutes from './routes/reschedule.js';
import chatbotRoutes from './routes/chatbot.js';
import flaggedRoutes from './routes/flagged.js';
import hl7Routes from './routes/hl7.js';
import db from './config/database.js';
import { initDailySync } from './services/dailySync.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './config/swagger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT) || 5000;

// --- CORS: configurable via ALLOWED_ORIGINS env var (comma-separated) ---
const normalizeOrigin = (value = '') => value.trim().replace(/\/+$/, '').toLowerCase();

const defaultAllowedOrigins = [
  'https://providers.chqi.org',
  'https://sms-portal.chqi.org',
  'https://www.sms-portal.chqi.org',
  'http://sms-portal.chqi.org',
  'https://api-sms-portal.chqi.org',
  'http://api-sms-portal.chqi.org',
  'https://providerdashboard-production.up.railway.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://192.168.0.106',
  'http://127.0.0.1:3005',
  'https://192.168.0.106'
];

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Keep safe defaults and extend with env overrides so production cannot accidentally
// lock out known frontend domains when ALLOWED_ORIGINS is partially configured.
const allowedOrigins = new Set(
  [...defaultAllowedOrigins, ...envAllowedOrigins].map((origin) => normalizeOrigin(origin)).filter(Boolean)
);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));
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
app.use('/api/county', countyRoutes);
app.use('/api/reschedule-requests', rescheduleRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/flagged', flaggedRoutes);
app.use('/api/hl7', hl7Routes);

app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// ── Serve frontend in production ONLY for frontend domain ──
const distPath = path.join(__dirname, '..', 'dist');
app.use((req, res, next) => {
  if (req.hostname === 'sms-portal.chqi.org') {
    express.static(distPath)(req, res, (err) => {
      if (err) return next(err);
      // If not a static file and not an API route, serve index.html for SPA routing
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  } else {
    next();
  }
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

const warmDatabasePool = async () => {
  const connectionsToWarm = Number(process.env.DB_WARM_CONNECTIONS || 8);
  try {
    await Promise.all(
      Array.from({ length: connectionsToWarm }, () => db.query('SELECT 1'))
    );
    console.log(`Database pool warmed with ${connectionsToWarm} connections`);
  } catch (error) {
    console.warn('Database warm-up failed; first request may be slower', error.message);
  }
};

// Start the server
console.log(`🚀 Starting server...`);
startServer(DEFAULT_PORT);
warmDatabasePool();

// Initialize daily sync cron job (9 PM EAT)
initDailySync();
