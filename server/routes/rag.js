import express from 'express';
import { processQuery } from '../services/rag.js';

const router = express.Router();

router.post('/query', async (req, res) => {
  try {
    const { message, phone, channel } = req.body;
    const normalizedChannel = !channel || channel === 'api' ? 'sms' : channel;

    if (!message || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Message and phone number are required',
      });
    }

    if (!['sms', 'whatsapp'].includes(normalizedChannel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel. Use sms or whatsapp.',
      });
    }

    const result = await processQuery(message, phone, normalizedChannel);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
    });
  }
});

export default router;
