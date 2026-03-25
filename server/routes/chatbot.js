import express from 'express';
import db from '../config/database.js';
import { processQuery } from '../services/rag.js';

const router = express.Router();

// ── Mental health flagging keywords (categorised by severity) ──
const FLAG_KEYWORDS = {
  critical: [
    'kill myself', 'suicide', 'suicidal', 'end my life', 'want to die',
    'take my life', 'better off dead', 'no reason to live', 'ending it all',
    'overdose', 'hang myself', 'cut myself', 'self-harm', 'self harm',
  ],
  high: [
    'depressed', 'depression', 'hopeless', 'worthless', 'give up',
    'cant go on', "can't go on", 'no hope', 'nobody cares', 'alone in this',
    'dont want to live', "don't want to live", 'tired of living',
    'hurting myself', 'harm myself', 'not worth it',
  ],
  medium: [
    'anxious', 'anxiety', 'panic attack', 'cant sleep', "can't sleep",
    'insomnia', 'nightmares', 'scared', 'overwhelmed', 'breaking down',
    'crying', 'lonely', 'isolated', 'stressed', 'burnout',
    'substance abuse', 'drinking too much', 'drug use',
  ],
};

function detectFlaggedWords(message) {
  const lower = message.toLowerCase();
  const found = [];
  let severity = null;

  for (const word of FLAG_KEYWORDS.critical) {
    if (lower.includes(word)) {
      found.push(word);
      severity = 'critical';
    }
  }
  for (const word of FLAG_KEYWORDS.high) {
    if (lower.includes(word)) {
      found.push(word);
      if (!severity) severity = 'high';
    }
  }
  for (const word of FLAG_KEYWORDS.medium) {
    if (lower.includes(word)) {
      found.push(word);
      if (!severity) severity = 'medium';
    }
  }

  return { flagged: found.length > 0, words: [...new Set(found)], severity };
}

/**
 * POST /api/chatbot/login
 * Patient login with phone number + CCC number
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, ccc_number } = req.body;

    if (!phone || !ccc_number) {
      return res.status(400).json({ success: false, error: 'Phone number and CCC number are required' });
    }

    // Look up patient by CCC number
    const result = await db.query(`
      SELECT p.id, p.first_name, p.last_name, p.phone, p.ccc_number, p.risk_level,
             p.facility_id, f.name AS facility_name, f.code AS facility_code
      FROM patients p
      LEFT JOIN facilities f ON p.facility_id = f.id
      WHERE p.ccc_number = $1
    `, [ccc_number.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid CCC number. Please check and try again.' });
    }

    const patient = result.rows[0];

    // Verify phone number matches
    const normalise = (p) => p.replace(/\s+/g, '').replace(/^0/, '+254');
    if (normalise(patient.phone) !== normalise(phone.trim())) {
      return res.status(401).json({ success: false, error: 'Phone number does not match the CCC number on file.' });
    }

    res.json({
      success: true,
      data: {
        patient_id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        phone: patient.phone,
        ccc_number: patient.ccc_number,
        facility_name: patient.facility_name,
        facility_id: patient.facility_id,
      },
    });
  } catch (error) {
    console.error('Chatbot login error:', error);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /api/chatbot/message
 * Send a message to the RAG chatbot. Flags harmful content silently.
 */
router.post('/message', async (req, res) => {
  try {
    const { message, patient_id } = req.body;

    if (!message || !patient_id) {
      return res.status(400).json({ success: false, error: 'Message and patient_id are required' });
    }

    // Special case: admin test chat (no DB lookup, no storage)
    if (patient_id === 'test-patient') {
      const ragResult = await processQuery(message, '0700000000', 'sms');
      return res.json({
        success: true,
        data: {
          response: ragResult.response,
          citations: ragResult.citations,
          conversationId: null,
        },
      });
    }

    // Fetch patient details for phone & facility
    const patientRes = await db.query(
      'SELECT id, phone, facility_id FROM patients WHERE id = $1', [patient_id]
    );
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    const patient = patientRes.rows[0];

    // Process through RAG pipeline
    const ragResult = await processQuery(message, patient.phone, 'sms');

    // ── Silent mental health flagging ──
    const flagCheck = detectFlaggedWords(message);
    if (flagCheck.flagged) {
      try {
        await db.query(`
          INSERT INTO flagged_patients
            (patient_id, facility_id, conversation_id, flagged_message, flagged_words, severity)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          patient.id,
          patient.facility_id,
          ragResult.conversationId || null,
          message,
          flagCheck.words,
          flagCheck.severity,
        ]);
        console.log(`🚩 Flagged patient ${patient.id} — severity: ${flagCheck.severity}, words: ${flagCheck.words.join(', ')}`);
      } catch (flagErr) {
        console.error('Failed to flag patient:', flagErr);
      }
    }

    res.json({
      success: true,
      data: {
        response: ragResult.response,
        citations: ragResult.citations,
        conversationId: ragResult.conversationId,
      },
    });
  } catch (error) {
    console.error('Chatbot message error:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

/**
 * GET /api/chatbot/history/:patientId
 * Load past conversations for a patient
 */
router.get('/history/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Special case: admin test chat (no DB lookup, no history)
    if (patientId === 'test-patient') {
      return res.json({ success: true, data: [] });
    }

    // Get patient phone to look up conversations
    const patientRes = await db.query('SELECT phone FROM patients WHERE id = $1', [patientId]);
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const result = await db.query(
      `SELECT id, message, response, created_at
       FROM conversations
       WHERE patient_phone = $1
       ORDER BY created_at ASC
       LIMIT 200`,
      [patientRes.rows[0].phone]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Chatbot history error:', error);
    res.status(500).json({ success: false, error: 'Failed to load history' });
  }
});

export default router;
