
import express from 'express';
import db from '../config/database.js';
import { pool } from '../config/database.js';
import { processQuery } from '../services/rag.js';

// ── Reschedule intent detection keywords ──
const RESCHEDULE_KEYWORDS = [
  'reschedule', 'reschedule appointment', 'change appointment',
  'move appointment', 'different date', 'another date',
  'change my date', 'change date', 'new appointment date',
  'postpone', 'postpone appointment', 'move my appointment',
  'cancel and rebook', 'rebook', 'shift appointment',
  'come on a different day', 'can i come another day',
  'i want to change my appointment', 'i need to reschedule',
];

function detectRescheduleIntent(message) {
  const lower = message.toLowerCase();
  return RESCHEDULE_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Viral load intent detection keywords ──
const VIRAL_LOAD_KEYWORDS = [
  'viral load', 'vl', 'virus load', 'what is my viral load',
  'whats my viral load', "what's my viral load", 'my viral load',
  'viral', 'load', 'check viral', 'check load',
];

function detectViralLoadIntent(message) {
  const lower = message.toLowerCase();
  return VIRAL_LOAD_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Fetch viral load from database ──
async function fetchViralLoad(patientId) {
  try {
    const result = await db.query(
      `SELECT last_viral_load FROM patients WHERE id = $1`,
      [patientId]
    );
    if (result.rows.length > 0) {
      return result.rows[0].last_viral_load;
    }
    return null;
  } catch (error) {
    console.error('Error fetching viral load:', error);
    return null;
  }
}

const router = express.Router();

/**
 * GET /api/chatbot/session/:clientid
 * Fetch patient session info by patient id (for client chat isolation)
 */
router.get('/session/:clientid', async (req, res) => {
  try {
    const { clientid } = req.params;
    if (!clientid) return res.status(400).json({ success: false, error: 'Missing clientid' });
    let result;
    try {
      result = await db.query(`
  SELECT p.id AS patient_id, p.first_name, p.last_name, p.phone, p.ccc_number, f.name AS facility_name
  FROM patients p
  LEFT JOIN facilities f ON p.facility_id = f.id
  WHERE p.id = $1
`, [clientid]);
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    if (!result || result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

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

    // Normalize CCC number to remove dashes and dots
    const normalizedCCC = ccc_number.replace(/[-.]/g, '');

    // Look up patient by normalized CCC number
    const result = await db.query(`
      SELECT p.id, p.first_name, p.last_name, p.phone, p.ccc_number, p.risk_level,
             p.facility_id, f.name AS facility_name, f.code AS facility_code
      FROM patients p
      LEFT JOIN facilities f ON p.facility_id = f.id
      WHERE REPLACE(REPLACE(p.ccc_number, '-', ''), '.', '') = $1
    `, [normalizedCCC.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid CCC number. Please check and try again.' });
    }

    const patient = result.rows[0];

    // Verify phone number matches
    // Normalize phone to 07XXXXXXXX format
    const normalizePhone = (p) => {
      let phone = p.replace(/\s+/g, '');
      if (phone.startsWith('+2547')) {
        return '0' + phone.slice(4);
      }
      return phone;
    };
    if (normalizePhone(patient.phone) !== normalizePhone(phone.trim())) {
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
    console.log('Received patient_id:', patient_id);

    if (!message || !patient_id) {
      return res.status(400).json({ success: false, error: 'Message and patient_id are required' });
    }

    // Special case: admin or test chat (no DB lookup, no storage)
    const isTestOrAdmin = (
      typeof patient_id === 'string' &&
      (patient_id === 'test-patient' || patient_id.startsWith('admin-'))
    );
    if (isTestOrAdmin) {
      try {
        const isRescheduleAdmin = detectRescheduleIntent(message);
        const isViralLoadAdmin = detectViralLoadIntent(message);
        
        let adminResponse;
        if (isViralLoadAdmin) {
          // For test/admin, return a sample viral load response
          adminResponse = {
            response: 'Your current viral load is 50 copies/mL. This is an important marker of your HIV treatment progress. Keep taking your medications as prescribed!',
            viralLoad: '50',
          };
        } else {
          const ragResult = await processQuery(message, '0700000000', 'sms');
          const botTriggeredRescheduleAdmin = ragResult.response &&
            ragResult.response.includes('Please select your preferred date from the calendar below');
          const showCalendarAdmin = isRescheduleAdmin || botTriggeredRescheduleAdmin;

          adminResponse = {
            response: showCalendarAdmin
              ? 'I can help you reschedule your appointment. Please select your preferred date from the calendar below.'
              : ragResult.response,
            citations: ragResult.citations,
            showCalendarAdmin: showCalendarAdmin,
          };
        }

        return res.json({
          success: true,
          data: {
            response: adminResponse.response,
            citations: adminResponse.citations || [],
            conversationId: null,
            type: adminResponse.showCalendarAdmin ? 'reschedule_calendar' : 'text',
            viralLoad: adminResponse.viralLoad,
          },
        });
      } catch (err) {
        console.error('Error in admin/test-patient RAG pipeline:', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to process admin/test message' });
      }
    }

    // Fetch patient details for phone & facility
    const patientRes = await db.query(
      'SELECT id, phone, facility_id FROM patients WHERE id = $1', [patient_id]
    );
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    const patient = patientRes.rows[0];

    // ── Detect reschedule intent ──
    const isReschedule = detectRescheduleIntent(message);

    // ── Detect viral load intent ──
    const isViralLoadQuery = detectViralLoadIntent(message);

    // Process through RAG pipeline
    const ragResult = await processQuery(message, patient.phone, 'sms');

    // If the bot response also contains the reschedule trigger phrase, flag it
    const botTriggeredReschedule = ragResult.response &&
      ragResult.response.includes('Please select your preferred date from the calendar below');

    // ── Handle viral load query ──
    let viralLoadResponse = ragResult.response;
    let viralLoadData = null;
    if (isViralLoadQuery) {
      const viralLoad = await fetchViralLoad(patient.id);
      viralLoadData = viralLoad;
      if (viralLoad) {
        viralLoadResponse = `Your current viral load is ${viralLoad} copies/mL. This is an important marker of your HIV treatment progress. Keep taking your medications as prescribed!`;
      } else {
        viralLoadResponse = `I don't have a recent viral load result in your file. Please contact your clinic or healthcare provider to get your viral load tested.`;
      }
    }

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

    const showCalendar = isReschedule || botTriggeredReschedule;

    res.json({
      success: true,
      data: {
        response: showCalendar
          ? 'I can help you reschedule your appointment. Please select your preferred date from the calendar below.'
          : isViralLoadQuery
          ? viralLoadResponse
          : ragResult.response,
        citations: ragResult.citations,
        conversationId: ragResult.conversationId,
        type: showCalendar ? 'reschedule_calendar' : 'text',
        viralLoad: isViralLoadQuery ? viralLoadData : undefined,
      },
    });
  } catch (error) {
    console.error('Chatbot message error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process message' });
  }
});

/**
 * POST /api/chatbot/reschedule
 * Submit a reschedule request from the chatbot calendar widget.
 * Body: { patient_id, requested_date, reason? }
 */
router.post('/reschedule', async (req, res) => {
  try {
    const { patient_id, requested_date, reason } = req.body;

    if (!patient_id || !requested_date) {
      return res.status(400).json({ success: false, error: 'patient_id and requested_date are required' });
    }

    // Validate date is in the future
    const parsed = new Date(requested_date);
    if (isNaN(parsed.getTime()) || parsed <= new Date()) {
      return res.status(400).json({ success: false, error: 'Please select a future date' });
    }

    // Fetch patient details
    const patientRes = await db.query(
      'SELECT id, first_name, last_name, phone, facility_id FROM patients WHERE id = $1',
      [patient_id]
    );
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    const patient = patientRes.rows[0];
    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

    // Find the most recent appointment
    let appointmentId = null;
    let originalDate = null;
    try {
      const apptRes = await pool.query(
        `SELECT id, appointment_date FROM appointments
         WHERE patient_id = $1 AND status IN ('missed','no_show','scheduled')
         ORDER BY appointment_date DESC LIMIT 1`,
        [patient_id]
      );
      if (apptRes.rows.length > 0) {
        appointmentId = apptRes.rows[0].id;
        originalDate = apptRes.rows[0].appointment_date;
      }
    } catch (apptErr) {
      console.error('Error fetching appointment:', apptErr);
    }

    // Format the date for display
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const fmtDate = `${parsed.getDate()} ${monthNames[parsed.getMonth()]} ${parsed.getFullYear()}`;

    // Insert reschedule request
    const result = await pool.query(
      `INSERT INTO reschedule_requests
       (patient_id, facility_id, appointment_id, phone_number, patient_name,
        original_appointment_date, requested_date, requested_date_raw, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING id`,
      [
        patient.id,
        patient.facility_id,
        appointmentId,
        patient.phone,
        patientName,
        originalDate,
        parsed.toISOString(),
        fmtDate,
        reason || 'Requested via chatbot',
      ]
    );

    // Save as a conversation so it appears in chat history
    try {
      await db.query(
        `INSERT INTO conversations (patient_phone, message, response, channel)
         VALUES ($1, $2, $3, 'chatbot')`,
        [
          patient.phone,
          `I would like to reschedule my appointment to ${fmtDate}`,
          `Your reschedule request for ${fmtDate} has been submitted. You will be notified once a clinician reviews it.`,
        ]
      );
    } catch (convErr) {
      console.error('Error saving reschedule conversation:', convErr);
    }

    res.json({
      success: true,
      data: {
        reschedule_id: result.rows[0].id,
        requested_date: fmtDate,
        message: `Your reschedule request for ${fmtDate} has been submitted. You will be notified once a clinician reviews it.`,
      },
    });
  } catch (error) {
    console.error('Chatbot reschedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit reschedule request' });
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
