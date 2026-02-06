import express from 'express';
import { query } from '../config/database.js';
import { checkHealth as checkGemini } from '../services/gemini.js';
import { checkHealth as checkPinecone } from '../services/pinecone.js';
import { checkHealth as checkSMS } from '../services/sms.js';
import { checkHealth as checkWhatsApp } from '../services/whatsapp.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const [geminiHealth, pineconeHealth, smsHealth, whatsappHealth] = await Promise.all([
      checkGemini().catch((e) => ({ status: 'down', error: e.message })),
      checkPinecone().catch((e) => ({ status: 'down', error: e.message })),
      checkSMS().catch((e) => ({ status: 'down', error: e.message })),
      checkWhatsApp().catch((e) => ({ status: 'down', error: e.message })),
    ]);

    const services = [
      {
        name: 'gemini',
        ...geminiHealth,
      },
      {
        name: 'vector_db',
        ...pineconeHealth,
      },
      {
        name: 'sms',
        ...smsHealth,
      },
      {
        name: 'whatsapp',
        ...whatsappHealth,
      },
    ];

    for (const service of services) {
      await query(
        `INSERT INTO system_health (service_name, status, last_check, error_message, response_time_ms)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (service_name)
         DO UPDATE SET status = $2, last_check = $3, error_message = $4, response_time_ms = $5`,
        [
          service.name,
          service.status,
          new Date().toISOString(),
          service.error || null,
          service.responseTime || null,
        ]
      );
    }

    const allHealthy = services.every((s) => s.status === 'healthy');

    res.json({
      success: true,
      status: allHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      success: false,
      status: 'down',
      error: 'Failed to check system health',
    });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const result = await query(
      'SELECT * FROM conversations WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
      ['error', parseInt(limit)]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error logs',
    });
  }
});

export default router;
