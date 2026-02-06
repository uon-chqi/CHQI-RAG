import express from 'express';
import { processQuery, checkRateLimit } from '../services/rag.js';
import { sendSMS } from '../services/sms.js';
import { sendWhatsApp } from '../services/whatsapp.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/sms/receive', webhookRateLimiter, async (req, res) => {
  try {
    const { from, text } = req.body;

    if (!from || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const rateCheck = await checkRateLimit(from, 'sms');
    if (!rateCheck.allowed) {
      await sendSMS(from, 'You have reached the message limit. Please wait a minute before sending another message.');
      return res.status(200).send('OK');
    }

    const result = await processQuery(text, from, 'sms');

    await sendSMS(from, result.response);

    res.status(200).send('OK');
  } catch (error) {
    console.error('SMS webhook error:', error);
    res.status(500).json({ error: 'Failed to process SMS' });
  }
});

router.post('/whatsapp/receive', webhookRateLimiter, async (req, res) => {
  try {
    const from = req.body.From || req.body.from;
    const body = req.body.Body || req.body.body;

    if (!from || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const phoneNumber = from.replace('whatsapp:', '');

    const rateCheck = await checkRateLimit(phoneNumber, 'whatsapp');
    if (!rateCheck.allowed) {
      await sendWhatsApp(from, 'You have reached the message limit. Please wait a minute before sending another message.');
      return res.status(200).send('OK');
    }

    const result = await processQuery(body, phoneNumber, 'whatsapp');

    await sendWhatsApp(from, result.response);

    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).json({ error: 'Failed to process WhatsApp message' });
  }
});

export default router;
