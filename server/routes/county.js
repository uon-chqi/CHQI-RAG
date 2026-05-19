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

const dashboardCache = new Map();
const COUNTY_DASHBOARD_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 60000);

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

    const cached = dashboardCache.get(cid);
    if (cached && cached.expiresAt > Date.now()) {
      res.set('Cache-Control', `private, max-age=${Math.floor(COUNTY_DASHBOARD_CACHE_TTL_MS / 1000)}`);
      return res.json(cached.payload);
    }

    const dashboardResult = await db.query(
      `WITH
        active_facilities AS (
          SELECT id, name, code, facility_type, operational_status, email
          FROM facilities
          WHERE county_id = $1 AND is_active = TRUE
        ),
        patient_by_facility AS (
          SELECT
            p.facility_id,
            COUNT(*)::int AS patient_count,
            COUNT(*) FILTER (WHERE p.risk_level = 'high')::int AS high_risk,
            COUNT(*) FILTER (
              WHERE p.next_appointment_date >= CURRENT_DATE
                AND p.next_appointment_date < CURRENT_DATE + INTERVAL '7 days'
            )::int AS upcoming_appointments,
            COUNT(*) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days')::int AS new_patients_30d
          FROM patients p
          JOIN active_facilities f ON p.facility_id = f.id
          WHERE p.is_active = TRUE
          GROUP BY p.facility_id
        ),
        county_patient_phones AS (
          SELECT DISTINCT p.phone
          FROM patients p
          JOIN active_facilities f ON p.facility_id = f.id
          WHERE p.is_active = TRUE AND p.phone IS NOT NULL
        ),
        conversation_summary AS (
          SELECT
            COUNT(*)::int AS total_conversations,
            COUNT(*) FILTER (WHERE c.created_at >= NOW() - INTERVAL '24 hours')::int AS messages_today
          FROM conversations c
          JOIN county_patient_phones cpp ON cpp.phone = c.patient_phone
        ),
        flagged_summary AS (
          SELECT COUNT(fp.id)::int AS flagged_patients
          FROM flagged_patients fp
          JOIN active_facilities f ON fp.facility_id = f.id
        ),
        summary AS (
          SELECT
            (SELECT COUNT(*)::int FROM active_facilities) AS total_facilities,
            COALESCE(SUM(pbf.patient_count), 0)::int AS total_patients,
            COALESCE(SUM(pbf.high_risk), 0)::int AS high_risk_patients,
            COALESCE(SUM(pbf.upcoming_appointments), 0)::int AS upcoming_appointments,
            COALESCE(SUM(pbf.new_patients_30d), 0)::int AS new_patients_30d,
            (SELECT total_conversations FROM conversation_summary) AS total_conversations,
            (SELECT messages_today FROM conversation_summary) AS messages_today,
            (SELECT flagged_patients FROM flagged_summary) AS flagged_patients,
            (SELECT name FROM counties WHERE id = $1) AS county_name
          FROM patient_by_facility pbf
        ),
        facilities_json AS (
          SELECT COALESCE(json_agg(row_to_json(facility_rows) ORDER BY facility_rows.name), '[]'::json) AS facilities
          FROM (
            SELECT
              f.id,
              f.name,
              f.code,
              f.facility_type,
              f.operational_status,
              f.email,
              COALESCE(pbf.patient_count, 0)::int AS patient_count,
              COALESCE(pbf.high_risk, 0)::int AS high_risk
            FROM active_facilities f
            LEFT JOIN patient_by_facility pbf ON pbf.facility_id = f.id
          ) facility_rows
        )
      SELECT row_to_json(summary) AS summary, facilities_json.facilities
      FROM summary, facilities_json`,
      [cid]
    );

    const row = dashboardResult.rows[0] || {};
    const summary = row.summary || {};

    const payload = { success: true, data: { ...summary, facilities: row.facilities || [] } };
    dashboardCache.set(cid, { expiresAt: Date.now() + COUNTY_DASHBOARD_CACHE_TTL_MS, payload });
    res.set('Cache-Control', `private, max-age=${Math.floor(COUNTY_DASHBOARD_CACHE_TTL_MS / 1000)}`);
    res.json(payload);
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
        COUNT(p.id)::int AS patient_count,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'high')::int AS high_risk
       FROM facilities f
       LEFT JOIN patients p ON p.facility_id = f.id AND p.is_active = TRUE
       WHERE f.county_id = $1 AND f.is_active = TRUE
       GROUP BY f.id, f.name, f.code, f.facility_type, f.operational_status, f.email
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

    const { search, risk_level, facility_id, page = 1, limit = 10 } = req.query;
    const effectiveLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
    const currentPage = Math.max(parseInt(page) || 1, 1);
    const offset = (currentPage - 1) * effectiveLimit;
    const params = [cid];
    let idx = 2;

    let where = 'WHERE f.county_id = $1 AND p.is_active = TRUE';
    if (facility_id) { where += ` AND p.facility_id = $${idx}`; params.push(facility_id); idx++; }
    if (risk_level) { where += ` AND p.risk_level = $${idx}`; params.push(risk_level); idx++; }
    if (search) {
      where += ` AND (p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR p.phone ILIKE $${idx} OR p.ccc_number ILIKE $${idx})`;
      params.push('%' + search + '%');
      idx++;
    }

    const countParams = [...params];
    const dataParams = [...params, effectiveLimit, offset];
    const [countResult, result] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM patients p JOIN facilities f ON p.facility_id = f.id ${where}`, countParams),
      db.query(
      `SELECT
         p.id,
         p.facility_id,
         f.name AS facility_name,
         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
         p.first_name,
         p.middle_name,
         p.last_name,
         p.phone,
         p.email,
         p.ccc_number,
         p.gods_number,
         p.patient_clinic_number,
         p.risk_level,
         p.next_appointment_date,
         p.created_at
       FROM patients p JOIN facilities f ON p.facility_id = f.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: { total, page: currentPage, pages: Math.ceil(total / effectiveLimit), limit: effectiveLimit }
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
