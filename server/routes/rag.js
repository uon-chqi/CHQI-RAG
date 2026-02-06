import express from 'express';
import { processQuery } from '../services/rag.js';

const router = express.Router();

router.post('/query', async (req, res) => {
  try {
    const { message, phone, channel = 'api' } = req.body;

    if (!message || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Message and phone number are required',
      });
    }

    const result = await processQuery(message, phone, channel);

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
