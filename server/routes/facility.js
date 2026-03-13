// ================================================================
// FACILITY API ROUTES
// ================================================================
// Facility-scoped endpoints — only returns data for the logged-in user's facility
// POST /api/facility/patients         - Add a patient
// GET  /api/facility/patients         - List facility's patients
// PUT  /api/facility/patients/:id     - Update a patient
// GET  /api/facility/dashboard        - Facility dashboard stats
// GET  /api/facility/conversations    - Facility conversations
// GET  /api/facility/messages         - Facility live messages

import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Middleware: extract facility_id from the token
function requireFacility(req, res, next) {
  if (req.user.role === 'super_admin') {
    // Super admin can optionally pass ?facility_id= to scope
    req.facilityId = req.query.facility_id || null;
    return next();
  }
  if (!req.user.facility_id) {
    return res.status(403).json({ success: false, error: 'No facility assigned to your account' });
  }
  req.facilityId = req.user.facility_id;
  next();
}

router.use(requireFacility);

// ────────────────────────────────────────────────────
// GET /api/facility/dashboard
// ────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const fid = req.facilityId;
    if (!fid) return res.status(400).json({ success: false, error: 'facility_id required' });

    const stats = await db.query(`
      SELECT
        (SELECT name FROM facilities WHERE id = $1) as facility_name,
        (SELECT code FROM facilities WHERE id = $1) as facility_code,
        (SELECT c.name FROM facilities f JOIN counties c ON f.county_id = c.id WHERE f.id = $1) as county_name,
        (SELECT COUNT(*) FROM patients WHERE facility_id = $1 AND is_active = TRUE) as total_patients,
        (SELECT COUNT(*) FROM patients WHERE facility_id = $1 AND risk_level = 'high') as high_risk_patients,
        (SELECT COUNT(*) FROM patients WHERE facility_id = $1 AND next_appointment_date BETWEEN NOW() AND NOW() + INTERVAL '7 days') as upcoming_appointments,
        (SELECT COUNT(*) FROM patients WHERE facility_id = $1 AND created_at >= NOW() - INTERVAL '30 days') as new_patients_30d,
        (SELECT COUNT(*) FROM conversations c2
         JOIN patients p ON c2.patient_phone = p.phone
         WHERE p.facility_id = $1) as total_conversations,
        (SELECT COUNT(*) FROM conversations c2
         JOIN patients p ON c2.patient_phone = p.phone
         WHERE p.facility_id = $1
           AND c2.created_at >= CURRENT_DATE) as messages_today
    `, [fid]);

    res.json({ success: true, data: stats.rows[0] });
  } catch (error) {
    console.error('Facility dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────────
// GET /api/facility/patients
// ────────────────────────────────────────────────────
router.get('/patients', async (req, res) => {
  try {
    const fid = req.facilityId;
    if (!fid) return res.status(400).json({ success: false, error: 'facility_id required' });

    const { search, risk_level, page = 1, limit = 50 } = req.query;
    const params = [fid];
    let where = 'WHERE p.facility_id = $1 AND p.is_active = TRUE';
    let idx = 2;

    if (risk_level) {
      where += ` AND p.risk_level = $${idx}`;
      params.push(risk_level);
      idx++;
    }
    if (search) {
      where += ` AND (p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR p.phone ILIKE $${idx} OR p.ccc_number ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await db.query(`
      SELECT p.id, p.first_name, p.last_name, p.date_of_birth, p.gender, p.phone, p.email,
             p.ccc_number, p.risk_level, p.enrollment_date, p.next_appointment_date,
             p.physical_address, p.created_at, p.updated_at
      FROM patients p
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params);

    const countResult = await db.query(`SELECT COUNT(*) as total FROM patients p ${where}`, params.slice(0, -2));

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
    });
  } catch (error) {
    console.error('Facility patients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────────
// POST /api/facility/patients
// ────────────────────────────────────────────────────
router.post('/patients', async (req, res) => {
  try {
    const fid = req.facilityId;
    if (!fid) return res.status(400).json({ success: false, error: 'facility_id required' });

    const {
      first_name, last_name, date_of_birth, gender, phone, email,
      ccc_number, risk_level, enrollment_date, next_appointment_date, physical_address,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'first_name and last_name are required' });
    }

    // Upsert by ccc_number if provided, otherwise insert
    let result;
    if (ccc_number) {
      result = await db.query(`
        INSERT INTO patients (facility_id, first_name, last_name, date_of_birth, gender, phone, email,
                              ccc_number, risk_level, enrollment_date, next_appointment_date, physical_address,
                              created_by, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
        ON CONFLICT (ccc_number) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          date_of_birth = COALESCE(EXCLUDED.date_of_birth, patients.date_of_birth),
          gender = COALESCE(EXCLUDED.gender, patients.gender),
          phone = COALESCE(EXCLUDED.phone, patients.phone),
          email = COALESCE(EXCLUDED.email, patients.email),
          risk_level = COALESCE(EXCLUDED.risk_level, patients.risk_level),
          next_appointment_date = COALESCE(EXCLUDED.next_appointment_date, patients.next_appointment_date),
          physical_address = COALESCE(EXCLUDED.physical_address, patients.physical_address),
          updated_at = NOW()
        RETURNING *
      `, [fid, first_name, last_name, date_of_birth || null, gender || null, phone || null, email || null,
          ccc_number, risk_level || 'normal', enrollment_date || new Date().toISOString().slice(0, 10),
          next_appointment_date || null, physical_address || null, req.user.id !== 'super_admin' ? req.user.id : null]);
    } else {
      result = await db.query(`
        INSERT INTO patients (facility_id, first_name, last_name, date_of_birth, gender, phone, email,
                              ccc_number, risk_level, enrollment_date, next_appointment_date, physical_address,
                              created_by, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
        RETURNING *
      `, [fid, first_name, last_name, date_of_birth || null, gender || null, phone || null, email || null,
          null, risk_level || 'normal', enrollment_date || new Date().toISOString().slice(0, 10),
          next_appointment_date || null, physical_address || null, req.user.id !== 'super_admin' ? req.user.id : null]);
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Add patient error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────────
// PUT /api/facility/patients/:id
// ────────────────────────────────────────────────────
router.put('/patients/:id', async (req, res) => {
  try {
    const fid = req.facilityId;
    if (!fid) return res.status(400).json({ success: false, error: 'facility_id required' });

    // Verify patient belongs to this facility
    const check = await db.query('SELECT id FROM patients WHERE id = $1 AND facility_id = $2', [req.params.id, fid]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found in your facility' });
    }

    const {
      first_name, last_name, date_of_birth, gender, phone, email,
      ccc_number, risk_level, next_appointment_date, physical_address,
    } = req.body;

    const result = await db.query(`
      UPDATE patients SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        date_of_birth = COALESCE($3, date_of_birth),
        gender = COALESCE($4, gender),
        phone = COALESCE($5, phone),
        email = COALESCE($6, email),
        ccc_number = COALESCE($7, ccc_number),
        risk_level = COALESCE($8, risk_level),
        next_appointment_date = COALESCE($9, next_appointment_date),
        physical_address = COALESCE($10, physical_address),
        updated_at = NOW()
      WHERE id = $11 AND facility_id = $12
      RETURNING *
    `, [first_name, last_name, date_of_birth, gender, phone, email,
        ccc_number, risk_level, next_appointment_date, physical_address,
        req.params.id, fid]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────────
// GET /api/facility/conversations
// ────────────────────────────────────────────────────
router.get('/conversations', async (req, res) => {
  try {
    const fid = req.facilityId;
    if (!fid) return res.status(400).json({ success: false, error: 'facility_id required' });

    const { page = 1, limit = 50, phone, channel } = req.query;
    const params = [fid];
    let where = 'WHERE p.facility_id = $1';
    let idx = 2;

    if (phone) {
      where += ` AND c.patient_phone ILIKE $${idx}`;
      params.push(`%${phone}%`);
      idx++;
    }
    if (channel) {
      where += ` AND c.channel = $${idx}`;
      params.push(channel);
      idx++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await db.query(`
      SELECT c.id, c.patient_phone, c.channel, c.message, c.response,
             c.response_time_ms, c.status, c.created_at,
             p.first_name || ' ' || p.last_name as patient_name, p.ccc_number
      FROM conversations c
      JOIN patients p ON c.patient_phone = p.phone
      ${where}
      ORDER BY c.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM conversations c JOIN patients p ON c.patient_phone = p.phone ${where}
    `, params.slice(0, -2));

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
    });
  } catch (error) {
    console.error('Facility conversations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────────
// GET /api/facility/messages  (live messages)
// ────────────────────────────────────────────────────
router.get('/messages', async (req, res) => {
  try {
    const fid = req.facilityId;
    if (!fid) return res.status(400).json({ success: false, error: 'facility_id required' });

    const { channel, status } = req.query;
    const params = [fid];
    let where = 'WHERE p.facility_id = $1';
    let idx = 2;

    if (channel && channel !== 'all') {
      where += ` AND c.channel = $${idx}`;
      params.push(channel);
      idx++;
    }
    if (status && status !== 'all') {
      where += ` AND c.status = $${idx}`;
      params.push(status);
      idx++;
    }

    const result = await db.query(`
      SELECT c.id, c.patient_phone, c.channel, c.message, c.response,
             c.response_time_ms, c.status, c.created_at,
             p.first_name || ' ' || p.last_name as patient_name
      FROM conversations c
      JOIN patients p ON c.patient_phone = p.phone
      ${where}
      ORDER BY c.created_at DESC
      LIMIT 50
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Facility messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
