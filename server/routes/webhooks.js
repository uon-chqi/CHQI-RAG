import express from 'express';
import { processQuery, checkRateLimit } from '../services/rag.js';
import { sendSMS } from '../services/sms.js';
import { sendWhatsApp } from '../services/whatsapp.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';
import { pool } from '../config/database.js';

const router = express.Router();

// ─── Hardcoded Two-Way SMS Flow Messages (from appointment flowchart) ───────
const FLOW = {
  confirm_yes:       'Great! See you then.',
  ask_reason:        'Kindly let us know why:\n1: Out of town\n2: Too Busy\n3: Still have medication\n4: Clinic not friendly\n5: Other',
  out_of_town:       'Pick medication from any clinic near you.',
  too_busy:          'Can you send someone to pick the medication?\n1: Yes\n2: No',
  still_have_meds:   'Ensure you return to clinic before you run out of medication.',
  clinic_unfriendly: 'Clinic is improving, please return.',
  other:             'Please visit the clinic as soon as you can.',
  delegate_yes:      'Thank you.',
  delegate_no:       'Please visit the clinic as soon as you can.',
};

/**
 * Check if this phone number is in an active two-way appointment conversation.
 * Returns the pending state row, or null if not in a two-way flow.
 */
async function getPendingTwoWayState(phone) {
  // Find the most recent pending state for this phone (followup_needed=true, followup_sent=false)
  const result = await pool.query(
    `SELECT * FROM sms_responses
     WHERE phone_number = $1 AND followup_needed = true AND followup_sent = false
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (result.rows.length > 0) return result.rows[0];

  // Or check if they received a two-way reminder in the last 48 hours they haven't replied to yet
  const reminder = await pool.query(
    `SELECT * FROM sms_sent_messages
     WHERE phone_number = $1 AND message_type = 'two_way_reminder'
     AND created_at > NOW() - INTERVAL '48 hours'
     AND id NOT IN (SELECT COALESCE(queue_message_id, '00000000-0000-0000-0000-000000000000') FROM sms_responses WHERE phone_number = $1)
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (reminder.rows.length > 0) return { reason_code: 'awaiting_initial', sent_message_id: reminder.rows[0].id, phone_number: phone, patient_id: reminder.rows[0].patient_id };

  return null;
}

/** Mark a pending state as done */
async function markStateDone(phone, reasonCode) {
  await pool.query(
    `UPDATE sms_responses SET followup_sent = true
     WHERE phone_number = $1 AND followup_needed = true AND followup_sent = false AND reason_code = $2`,
    [phone, reasonCode]
  );
}

/** Record a new pending state (waiting for next reply) */
async function recordState(phone, patientId, queueMsgId, reasonCode) {
  await pool.query(
    `INSERT INTO sms_responses (phone_number, patient_id, queue_message_id, response_text, reason_code, followup_needed, followup_sent)
     VALUES ($1, $2, $3, $4, $5, true, false)`,
    [phone, patientId, queueMsgId, reasonCode, reasonCode]
  );
}

/** Record a terminal state (no more followup) */
async function recordTerminal(phone, patientId, responseText, reasonCode) {
  await pool.query(
    `INSERT INTO sms_responses (phone_number, patient_id, queue_message_id, response_text, reason_code, followup_needed, followup_sent)
     VALUES ($1, $2, NULL, $3, $4, false, true)`,
    [phone, patientId, responseText, reasonCode]
  );
}

/**
 * Handle the two-way appointment confirmation flow.
 * Returns true if this SMS was handled by the flow (don't pass to RAG).
 */
async function handleTwoWayFlow(phone, text) {
  const reply = text.trim();
  const state = await getPendingTwoWayState(phone);
  if (!state) return false;

  const patientId = state.patient_id || null;
  const stateCode = state.reason_code;

  // ── State: client just got the "Will you attend? 1/2" message ──
  if (stateCode === 'awaiting_initial') {
    if (reply === '1') {
      await sendSMS(phone, FLOW.confirm_yes);
      await recordTerminal(phone, patientId, reply, 'confirmed_yes');
    } else if (reply === '2') {
      await sendSMS(phone, FLOW.ask_reason);
      await recordState(phone, patientId, null, 'waiting_reason');
    } else {
      // Unrecognised — re-prompt
      await sendSMS(phone, 'Please reply 1 for Yes or 2 for No.');
      return true;
    }
    return true;
  }

  // ── State: waiting for reason (1–5) ──
  if (stateCode === 'waiting_reason') {
    await markStateDone(phone, 'waiting_reason');
    if (reply === '1') {
      await sendSMS(phone, FLOW.out_of_town);
      await recordTerminal(phone, patientId, reply, 'reason_out_of_town');
    } else if (reply === '2') {
      await sendSMS(phone, FLOW.too_busy);
      await recordState(phone, patientId, null, 'waiting_delegate');
    } else if (reply === '3') {
      await sendSMS(phone, FLOW.still_have_meds);
      await recordTerminal(phone, patientId, reply, 'reason_still_have_meds');
    } else if (reply === '4') {
      await sendSMS(phone, FLOW.clinic_unfriendly);
      await recordTerminal(phone, patientId, reply, 'reason_clinic_unfriendly');
    } else if (reply === '5') {
      await sendSMS(phone, FLOW.other);
      await recordTerminal(phone, patientId, reply, 'reason_other');
    } else {
      await sendSMS(phone, 'Please reply with a number 1–5.');
    }
    return true;
  }

  // ── State: waiting for delegate answer (1 Yes / 2 No) ──
  if (stateCode === 'waiting_delegate') {
    await markStateDone(phone, 'waiting_delegate');
    if (reply === '1') {
      await sendSMS(phone, FLOW.delegate_yes);
      await recordTerminal(phone, patientId, reply, 'delegate_yes');
    } else {
      await sendSMS(phone, FLOW.delegate_no);
      await recordTerminal(phone, patientId, reply, 'delegate_no');
    }
    return true;
  }

  return false;
}

router.post('/sms/receive', webhookRateLimiter, async (req, res) => {
  try {
    console.log('🔔 SMS Webhook received:', { body: req.body, timestamp: new Date().toISOString() });

    const { from, text } = req.body;
    if (!from || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // First: check if this is part of a two-way appointment flow
    const handledByFlow = await handleTwoWayFlow(from, text);
    if (handledByFlow) {
      console.log('✅ Handled by two-way appointment flow:', from);
      return res.status(200).send('OK');
    }

    // Otherwise: pass to RAG for general queries
    const rateCheck = await checkRateLimit(from, 'sms');
    if (!rateCheck.allowed) {
      await sendSMS(from, 'You have reached the message limit. Please wait a minute before sending another message.');
      return res.status(200).send('OK');
    }

    const result = await processQuery(text, from, 'sms');
    await sendSMS(from, result.response);

    console.log('✅ SMS processed successfully for:', from);
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
