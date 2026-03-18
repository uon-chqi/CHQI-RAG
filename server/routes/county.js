// ================================================================
// COUNTY-SCOPED API ROUTES
// ================================================================
// GET  /api/county/dashboard        - County dashboard stats
// GET  /api/county/patients         - County patients (across facilities)
// GET  /api/county/conversations    - County conversations
// GET  /api/county/facilities       - Facilities in the county
// ================================================================

import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Middleware: resolve county_id from token or query param
function requireCounty(req, res, next) {
  if (req.user.role === 'super_admin' || req.user.role === 'national') {
    req.countyId = req.query.county_id || null;
    return next();
  }
  if (req.user.role === 'county') {
    if (!req.user.county_id) {
      return res.status(403).json({ success: false, error: 'No county assigned to your account' });
    }
    req.countyId = req.user.county_id;
    return next();
  }
  return res.status(403).json({ success: false, error: 'County access required' });
}

router.use(requireCounty);

// ── GET /api/county/dashboard ──────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const cid = req.countyId;
    if (!cid) return res.status(400).json({ success: false, error: 'county_id required' });

    const summary = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM facilities WHERE county_id = $1 AND is_active = TRUE) AS total_facilities,
        (SELECT COUNT(*) FROM patients p JOIN facilities f ON p.facility_id = f.id WHERE f.county_id = $1) AS total_patients,
        (SELECT COUNT(*) FROM patients p JOIN facilities f ON p.facility_id = f.id WHERE f.county_id = $1 AND p.risk_level = 'high') AS high_risk_patients,
        (SELECT COUNT(*) FROM patients p JOIN facilities f ON p.facility_id = f.id WHERE f.county_id = $1
          AND p.next_appointment_date >= CURRENT_DATE AND p.next_appointment_date < CURRENT_DATE + INTERVAL '7 days') AS upcoming_appointments,
        (SELECT COUNT(*) FROM conversations c2 JOIN patients p2 ON c2.patient_phone = p2.phone
          JOIN facilities f2 ON p2.facility_id = f2.id WHERE f2.county_id = $1) AS total_conversations,
        (SELECT COUNT(*) FROM conversations c3 JOIN patients p3 ON c3.patient_phone = p3.phone
          JOIN facilities f3 ON p3.facility_id = f3.id WHERE f3.county_id = $1 AND c3.created_at >= NOW() - INTERVAL '24 hours') AS messages_today,
        (SELECT COUNT(*) FROM patients p4 JOIN facilities f4 ON p4.facility_id = f4.id
          WHERE f4.county_id = $1 AND p4.created_at >= NOW() - INTERVAL '30 days') AS new_patients_30d,
        (SELECT name FROM counties WHERE id = $1) AS county_name`,
      [cid]
    );

    res.json({ success: true, data: summary.rows[0] || {} });
  } catch (error) {
    console.error('County dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/county/facilities ─────────────────────────────
router.get('/facilities', async (req, res) => {
  try {
    const cid = req.countyId;
    if (!cid) return res.status(400).json({ success: false, error: 'county_id required' });

    const result = await db.query(
      `SELECT f.id, f.name, f.code, f.facility_type, f.operational_status, f.email,
        (SELECT COUNT(*) FROM patients WHERE facility_id = f.id) AS patient_count,
        (SELECT COUNT(*) FROM patients WHERE facility_id = f.id AND risk_level = 'high') AS high_risk
       FROM facilities f
       WHERE f.county_id = $1 AND f.is_active = TRUE
       ORDER BY f.name`,
      [cid]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('County facilities error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/county/patients ───────────────────────────────
router.get('/patients', async (req, res) => {
  try {
    const cid = req.countyId;
    if (!cid) return res.status(400).json({ success: false, error: 'county_id required' });

    const { search, risk_level, facility_id, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [cid];
    let idx = 2;

    let where = 'WHERE f.county_id = $1';
    if (facility_id) { where += ` AND p.facility_id = $${idx}`; params.push(facility_id); idx++; }
    if (risk_level) { where += ` AND p.risk_level = $${idx}`; params.push(risk_level); idx++; }
    if (search) {
      where += ` AND (p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR p.phone ILIKE $${idx} OR p.ccc_number ILIKE $${idx})`;
      params.push('%' + search + '%');
      idx++;
    }

    const countResult = await db.query(`SELECT COUNT(*) FROM patients p JOIN facilities f ON p.facility_id = f.id ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await db.query(
      `SELECT p.*, f.name AS facility_name
       FROM patients p JOIN facilities f ON p.facility_id = f.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('County patients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/county/conversations ──────────────────────────
router.get('/conversations', async (req, res) => {
  try {
    const cid = req.countyId;
    if (!cid) return res.status(400).json({ success: false, error: 'county_id required' });

    const { phone, channel } = req.query;
    const params = [cid];
    let idx = 2;
    let where = 'WHERE f.county_id = $1';
    if (phone) { where += ` AND c.patient_phone ILIKE $${idx}`; params.push('%' + phone + '%'); idx++; }
    if (channel && channel !== 'all') { where += ` AND c.channel = $${idx}`; params.push(channel); idx++; }

    const result = await db.query(
      `SELECT c.*, p.first_name, p.last_name, f.name AS facility_name
       FROM conversations c
       JOIN patients p ON c.patient_phone = p.phone
       JOIN facilities f ON p.facility_id = f.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT 200`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('County conversations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
