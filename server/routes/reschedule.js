import express from 'express';
import { pool } from '../config/database.js';
import { sendSMS } from '../services/sms.js';

const router = express.Router();

/**
 * GET /api/reschedule-requests
 * List all reschedule requests (for Provider Dashboard).
 * Query params: ?status=pending|approved|rejected&facility_id=UUID&mfl_code=STRING
 */
router.get('/', async (req, res) => {
  try {
    const { status, facility_id, mfl_code } = req.query;
    let sql = `
      SELECT r.*, 
        p.first_name, p.last_name, p.phone, p.ccc_number, p.risk_level, p.gender,
        f.name AS facility_name, f.code AS facility_code,
        c.name AS county_name
      FROM reschedule_requests r
      LEFT JOIN patients p ON r.patient_id = p.id
      LEFT JOIN facilities f ON r.facility_id = f.id
      LEFT JOIN counties c ON f.county_id = c.id
    `;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (facility_id) {
      params.push(facility_id);
      conditions.push(`r.facility_id = $${params.length}`);
    }
    if (mfl_code) {
      params.push(mfl_code);
      conditions.push(`f.code = $${params.length}`);
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY r.created_at DESC';

    const result = await pool.query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching reschedule requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reschedule requests' });
  }
});

/**
 * GET /api/reschedule-requests/:id
 * Get a single reschedule request with full details.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.*,
        p.first_name, p.last_name, p.phone, p.ccc_number, p.risk_level, p.gender,
        p.date_of_birth, p.email, p.physical_address,
        f.name AS facility_name, f.code AS facility_code,
        c.name AS county_name
      FROM reschedule_requests r
      LEFT JOIN patients p ON r.patient_id = p.id
      LEFT JOIN facilities f ON r.facility_id = f.id
      LEFT JOIN counties c ON f.county_id = c.id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reschedule request not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching reschedule request:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reschedule request' });
  }
});

/**
 * PUT /api/reschedule-requests/:id
 * Approve or reject a reschedule request.
 * Body: { action: 'approved' | 'rejected', reviewed_by?: UUID }
 * Automatically sends SMS to the patient.
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reviewed_by } = req.body;

    if (!action || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be "approved" or "rejected"' });
    }

    // Update the request
    const result = await pool.query(`
      UPDATE reschedule_requests
      SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [action, reviewed_by || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reschedule request not found' });
    }

    const request = result.rows[0];

    // Format the requested date nicely
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const d = new Date(request.requested_date);
    const fmtDate = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    // Send SMS notification to patient
    let smsMessage;
    if (action === 'approved') {
      smsMessage = `Your appointment reschedule request for ${fmtDate} has been approved. See you then!`;

      // Also create a new appointment in the appointments table
      await pool.query(`
        INSERT INTO appointments (patient_id, facility_id, appointment_date, appointment_type, status, notes)
        VALUES ($1, $2, $3, 'follow_up', 'scheduled', $4)
      `, [request.patient_id, request.facility_id, request.requested_date, 'Rescheduled via SMS']);

      // Update patient's next_appointment_date
      await pool.query(
        'UPDATE patients SET next_appointment_date = $1, updated_at = NOW() WHERE id = $2',
        [request.requested_date, request.patient_id]
      );
    } else {
      smsMessage = `Your appointment reschedule request for ${fmtDate} was not approved. Please contact the clinic for assistance.`;
    }

    try {
      await sendSMS(request.phone_number, smsMessage);
      await pool.query(
        'UPDATE reschedule_requests SET sms_notification_sent = true WHERE id = $1',
        [id]
      );
    } catch (smsErr) {
      console.error('Failed to send reschedule SMS:', smsErr);
    }

    // Log the sent message
    try {
      await pool.query(`
        INSERT INTO sms_sent_messages
        (patient_id, facility_id, message_type, phone_number, message_body, channel, status)
        VALUES ($1, $2::text, $3, $4, $5, 'sms', 'sent')
      `, [request.patient_id, request.facility_id, `reschedule_${action}`, request.phone_number, smsMessage]);
    } catch (logErr) {
      console.error('Failed to log SMS message:', logErr);
    }

    // Also save a conversation record so the patient sees it in chatbot history
    try {
      const chatMessage = action === 'approved'
        ? `Great news! Your rescheduled appointment for ${fmtDate} has been approved. See you then!`
        : `Your appointment reschedule request for ${fmtDate} was not approved. Please contact the clinic for assistance.`;

      await pool.query(
        `INSERT INTO conversations (patient_phone, message, response, channel)
         VALUES ($1, $2, $3, 'chatbot')`,
        [
          request.phone_number,
          `Reschedule request update for ${fmtDate}`,
          chatMessage,
        ]
      );
    } catch (convErr) {
      console.error('Failed to save reschedule conversation:', convErr);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating reschedule request:', error);
    res.status(500).json({ success: false, error: 'Failed to update reschedule request' });
  }
});

export default router;
