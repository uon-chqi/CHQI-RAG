import express from 'express';
import { processQuery, checkRateLimit } from '../services/rag.js';
import { sendSMS } from '../services/sms.js';
import { sendWhatsApp } from '../services/whatsapp.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';
import { pool } from '../config/database.js';

const router = express.Router();

// ─── Hardcoded Two-Way SMS Flow Messages (from appointment flowchart) ───────
const FLOW = {
  // Pre-appointment (1 day before)
  confirm_yes:       'Great! See you then.',
  ask_reason:        'Kindly let us know why:\n1: Out of town\n2: Too Busy\n3: Still have medication\n4: Clinic not friendly\n5: Other',
  out_of_town:       'Pick medication from any clinic near you.',
  too_busy:          'Can you send someone to pick the medication?\n1: Yes\n2: No',
  still_have_meds:   'Ensure you return to clinic before you run out of medication.',
  clinic_unfriendly: 'Clinic is improving, please return.',
  other:             'Please visit the clinic as soon as you can.',
  delegate_yes:      'Thank you.',
  delegate_no:       'Please visit the clinic as soon as you can.',

  // Missed appointment (24 hours after)
  missed_initial:    'You missed your appointment yesterday, kindly let us know why:\n1: Out of town\n2: Too Busy\n3: Still have medication\n4: Clinic not friendly\n5: Other',
  missed_out_of_town:    'Pick medication from any clinic near you.\nWould you like to reschedule? Reply YES or NO.',
  missed_too_busy:       'Can you send someone to pick the medication?\n1: Yes\n2: No',
  missed_still_have_meds:'Ensure you return to clinic before you run out of medication.\nWould you like to reschedule? Reply YES or NO.',
  missed_clinic_unfriendly:'Clinic is improving, please return.\nWould you like to reschedule? Reply YES or NO.',
  missed_other:          'Please visit the clinic as soon as you can.\nWould you like to reschedule? Reply YES or NO.',
  missed_delegate_yes:   'Thank you.\nWould you like to reschedule? Reply YES or NO.',
  missed_delegate_no:    'Please visit the clinic as soon as you can.\nWould you like to reschedule? Reply YES or NO.',
  ask_reschedule_date:   'Please reply with your preferred date (e.g. 12 April 2026 or 12/04/2026).',
  reschedule_saved:      'Thank you! Your reschedule request for {date} has been submitted. You will receive an SMS once it is approved or rejected.',
  reschedule_declined:   'No problem. Please visit the clinic as soon as you can.',
};

/**
 * Parse a date from freeform text like "12 april 2026", "12/04/2026", "april 12", "12-04-2026" etc.
 * Returns a Date object or null if unparseable.
 */
function parseDateFromText(text) {
  const s = text.trim().toLowerCase().replace(/[,]/g, '');

  // Month name map
  const months = { jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11 };

  // "12 april 2026" or "12th april 2026"
  let m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})$/);
  if (m && months[m[2]] !== undefined) return new Date(parseInt(m[3]), months[m[2]], parseInt(m[1]));

  // "april 12 2026" or "april 12th 2026"
  m = s.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/);
  if (m && months[m[1]] !== undefined) return new Date(parseInt(m[3]), months[m[1]], parseInt(m[2]));

  // "12 april" or "april 12" (assume current year)
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/);
  if (m && months[m[2]] !== undefined) return new Date(new Date().getFullYear(), months[m[2]], parseInt(m[1]));
  m = s.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if (m && months[m[1]] !== undefined) return new Date(new Date().getFullYear(), months[m[1]], parseInt(m[2]));

  // "12/04/2026" or "12-04-2026" (DD/MM/YYYY)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));

  // "2026-04-12" (ISO)
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));

  return null;
}

/** Format a date as "12 April 2026" */
function formatDate(d) {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

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

  // ── MISSED APPOINTMENT FLOW STATES ──

  // State: client received "You missed your appointment" — waiting for reason 1-5
  if (stateCode === 'missed_waiting_reason') {
    await markStateDone(phone, 'missed_waiting_reason');
    if (reply === '1') {
      await sendSMS(phone, FLOW.missed_out_of_town);
      await recordState(phone, patientId, null, 'missed_ask_reschedule');
    } else if (reply === '2') {
      await sendSMS(phone, FLOW.missed_too_busy);
      await recordState(phone, patientId, null, 'missed_waiting_delegate');
    } else if (reply === '3') {
      await sendSMS(phone, FLOW.missed_still_have_meds);
      await recordState(phone, patientId, null, 'missed_ask_reschedule');
    } else if (reply === '4') {
      await sendSMS(phone, FLOW.missed_clinic_unfriendly);
      await recordState(phone, patientId, null, 'missed_ask_reschedule');
    } else if (reply === '5') {
      await sendSMS(phone, FLOW.missed_other);
      await recordState(phone, patientId, null, 'missed_ask_reschedule');
    } else {
      await sendSMS(phone, 'Please reply with a number 1–5.');
    }
    return true;
  }

  // State: missed → too busy → can you send someone? 1 Yes / 2 No
  if (stateCode === 'missed_waiting_delegate') {
    await markStateDone(phone, 'missed_waiting_delegate');
    if (reply === '1') {
      await sendSMS(phone, FLOW.missed_delegate_yes);
      await recordState(phone, patientId, null, 'missed_ask_reschedule');
    } else {
      await sendSMS(phone, FLOW.missed_delegate_no);
      await recordState(phone, patientId, null, 'missed_ask_reschedule');
    }
    return true;
  }

  // State: ask if they want to reschedule (YES / NO)
  if (stateCode === 'missed_ask_reschedule') {
    await markStateDone(phone, 'missed_ask_reschedule');
    const lc = reply.toLowerCase();
    if (lc === 'yes' || lc === '1' || lc === 'y') {
      await sendSMS(phone, FLOW.ask_reschedule_date);
      await recordState(phone, patientId, null, 'waiting_reschedule_date');
    } else {
      await sendSMS(phone, FLOW.reschedule_declined);
      await recordTerminal(phone, patientId, reply, 'reschedule_declined');
    }
    return true;
  }

  // State: waiting for the reschedule date text
  if (stateCode === 'waiting_reschedule_date') {
    await markStateDone(phone, 'waiting_reschedule_date');
    const parsed = parseDateFromText(reply);
    if (!parsed || isNaN(parsed.getTime()) || parsed < new Date()) {
      await sendSMS(phone, 'Sorry, we could not understand that date or it is in the past. Please reply with a future date (e.g. 12 April 2026 or 12/04/2026).');
      await recordState(phone, patientId, null, 'waiting_reschedule_date');
      return true;
    }

    // Save reschedule request
    try {
      // Get patient details
      const patientResult = patientId
        ? await pool.query('SELECT first_name, last_name, facility_id FROM patients WHERE id = $1', [patientId])
        : await pool.query('SELECT id, first_name, last_name, facility_id FROM patients WHERE phone = $1 LIMIT 1', [phone]);
      const patient = patientResult.rows[0];
      const pId = patientId || patient?.id;
      const pName = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : '';
      const facilityId = patient?.facility_id;

      // Find the most recent missed appointment
      const apptResult = await pool.query(
        `SELECT id, appointment_date FROM appointments
         WHERE patient_id = $1 AND status IN ('missed','no_show','scheduled')
         ORDER BY appointment_date DESC LIMIT 1`,
        [pId]
      );

      await pool.query(
        `INSERT INTO reschedule_requests
         (patient_id, facility_id, appointment_id, phone_number, patient_name, original_appointment_date, requested_date, requested_date_raw, reason, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
        [
          pId, facilityId,
          apptResult.rows[0]?.id || null,
          phone, pName,
          apptResult.rows[0]?.appointment_date || null,
          parsed.toISOString(),
          reply,
          state.response_text || 'missed appointment',
        ]
      );

      const fmtDate = formatDate(parsed);
      await sendSMS(phone, FLOW.reschedule_saved.replace('{date}', fmtDate));
      await recordTerminal(phone, patientId, reply, 'reschedule_requested');
    } catch (err) {
      console.error('Error saving reschedule request:', err);
      await sendSMS(phone, 'Sorry, something went wrong saving your request. Please try again later.');
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
