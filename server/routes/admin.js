// ================================================================
// ADMIN DASHBOARD API ROUTES
// ================================================================
// API endpoints for super admin dashboard and centralized reporting

import express from 'express';
import bcrypt from 'bcrypt';
import db from '../config/database.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

let overviewCache = null;
const OVERVIEW_CACHE_TTL_MS = 10000;

/**
 * GET /api/admin/dashboard
 * Super admin dashboard with all facilities and data
 */
router.get('/dashboard', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {

    // Get summary statistics
    const summaryQuery = `
      SELECT
        (SELECT COUNT(*) FROM facilities WHERE is_active = TRUE) as total_facilities,
        (SELECT COUNT(*) FROM counties WHERE is_active = TRUE) as total_counties,
        (SELECT COUNT(*) FROM patients) as total_patients,
        (SELECT COUNT(*) FROM auth_users WHERE is_active = TRUE) as total_users,
        (SELECT COUNT(*) FROM patients WHERE risk_level = 'high') as high_risk_patients,
        (SELECT COUNT(*) FROM data_sync_log WHERE sync_status = 'completed' AND created_at >= NOW() - INTERVAL '24 hours') as syncs_last_24h
    `;

    const summaryResult = await db.query(summaryQuery);
    const summary = summaryResult.rows[0];

    // Get facility breakdown
    const facilitiesQuery = `
      SELECT
        f.id,
        f.name,
        f.code,
        c.name as county_name,
        f.facility_type,
        f.operational_status,
        COUNT(p.id) as patient_count,
        (SELECT COUNT(*) FROM auth_users WHERE facility_id = f.id AND is_active = TRUE) as active_staff,
        (SELECT created_at FROM data_sync_log WHERE facility_id = f.id ORDER BY created_at DESC LIMIT 1) as last_sync
      FROM facilities f
      LEFT JOIN counties c ON f.county_id = c.id
      LEFT JOIN patients p ON f.id = p.facility_id
      WHERE f.is_active = TRUE
      GROUP BY f.id, f.name, f.code, c.name, f.facility_type, f.operational_status
      ORDER BY f.name
    `;

    const facilitiesResult = await db.query(facilitiesQuery);

    // Get county breakdown
    const countiesQuery = `
      SELECT
        c.id,
        c.name,
        c.code,
        COUNT(f.id) as facility_count,
        SUM(COALESCE((SELECT COUNT(*) FROM patients WHERE facility_id = f.id), 0)) as patient_count,
        (SELECT COUNT(*) FROM auth_users WHERE county_id = c.id AND is_active = TRUE) as active_admins
      FROM counties c
      LEFT JOIN facilities f ON c.id = f.county_id
      WHERE c.is_active = TRUE
      GROUP BY c.id, c.name, c.code
      ORDER BY c.name
    `;

    const countiesResult = await db.query(countiesQuery);

    res.json({
      success: true,
      data: {
        summary,
        facilities: facilitiesResult.rows,
        counties: countiesResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/county/:countyId/dashboard
 * County admin dashboard for their county
 */
router.get('/county/:countyId/dashboard', authenticateToken, async (req, res) => {
  try {
    const countyId = req.params.countyId;

    // Get county summary
    const summaryQuery = `
      SELECT
        c.name,
        c.code,
        COUNT(DISTINCT f.id) as facility_count,
        COUNT(DISTINCT p.id) as total_patients
      FROM counties c
      LEFT JOIN facilities f ON c.id = f.county_id
      LEFT JOIN patients p ON f.id = p.facility_id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.code
    `;

    const summaryResult = await db.query(summaryQuery, [countyId]);

    // Get facilities in county
    const facilitiesQuery = `
      SELECT
        f.id,
        f.name,
        f.code,
        f.facility_type,
        f.operational_status,
        COUNT(DISTINCT p.id) as patient_count
      FROM facilities f
      LEFT JOIN patients p ON f.id = p.facility_id
      WHERE f.county_id = $1
      GROUP BY f.id, f.name, f.code, f.facility_type, f.operational_status
      ORDER BY f.name
    `;

    const facilitiesResult = await db.query(facilitiesQuery, [countyId]);

    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        facilities: facilitiesResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching county dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/facilities-data
 * Get centralized patient data for all facilities (super admin)
 */
router.get('/facilities-data', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const facilityId = req.query.facility_id;
    let whereClause = 'WHERE p.is_active = TRUE';
    const params = [];
    let pi = 1;

    if (facilityId) {
      whereClause += ` AND p.facility_id = $${pi}`;
      params.push(facilityId);
      pi++;
    }

    const sqlQuery = `
      SELECT
        p.id,
        p.facility_id,
        f.name as facility_name,
        f.code as facility_code,
        c.name as county_name,
        p.first_name,
        p.last_name,
        p.ccc_number,
        p.gender,
        p.phone,
        p.email,
        p.risk_level,
        p.next_appointment_date,
        p.created_at
      FROM patients p
      INNER JOIN facilities f ON p.facility_id = f.id
      LEFT JOIN counties c ON f.county_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT 500
    `;

    const result = await db.query(sqlQuery, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching centralized data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit-log
 * Returns sync log
 */
router.get('/audit-log', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    let sqlQuery, params;

    try {
      sqlQuery = `
        SELECT id, facility_id, sync_status, records_synced, error_message, created_at
        FROM data_sync_log
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const result = await db.query(sqlQuery, [limit, offset]);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (_) {
      res.json({ success: true, count: 0, data: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/sync-status
 * Get sync status for all facilities
 */
router.get('/sync-status', authenticateToken, async (req, res) => {
  try {
    const sqlQuery = `
      SELECT DISTINCT ON (facility_id)
        facility_id,
        sync_status,
        records_synced,
        created_at
      FROM data_sync_log
      ORDER BY facility_id, created_at DESC
    `;

    try {
      const result = await db.query(sqlQuery);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (_) {
      res.json({ success: true, count: 0, data: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// PUBLIC OVERVIEW ENDPOINTS (no auth required — display only)
// ================================================================

/**
 * GET /api/admin/overview
 * Returns full org hierarchy: counties → facilities + user counts
 */
router.get('/overview', async (req, res) => {
  try {
    if (overviewCache && overviewCache.expiresAt > Date.now()) {
      res.set('Cache-Control', 'private, max-age=10');
      return res.json(overviewCache.payload);
    }

    const [
      countyCountResult,
      facilityCountResult,
      patientSummaryResult,
      userCountResult,
      conversationSummaryResult,
      documentCountResult,
      countiesResult,
      facilitiesResult
    ] = await Promise.all([
      db.query(`
        SELECT COUNT(*) AS total_counties
        FROM counties
        WHERE is_active = TRUE
      `),
      db.query(`
        SELECT COUNT(*) AS total_facilities
        FROM facilities
        WHERE is_active = TRUE
      `),
      db.query(`
        SELECT
          COUNT(*) AS total_patients,
          COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_patients,
          COUNT(*) FILTER (
            WHERE next_appointment_date >= CURRENT_DATE
              AND next_appointment_date < CURRENT_DATE + INTERVAL '7 days'
          ) AS upcoming_appointments,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_patients_30d
        FROM patients
        WHERE is_active = TRUE
      `),
      db.query(`
        SELECT COUNT(*) AS total_users
        FROM auth_users
        WHERE is_active = TRUE
      `),
      db.query(`
        SELECT
          COUNT(*) AS total_conversations,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS messages_today
        FROM conversations
      `),
      db.query(`
        SELECT COUNT(*) AS total_documents
        FROM documents
      `),
      db.query(`
        SELECT
          c.id,
          c.name,
          c.code,
          c.is_active,
          c.created_at,
          COUNT(DISTINCT f.id)::int AS facility_count,
          COUNT(p.id)::int AS patient_count,
          COUNT(p.id) FILTER (WHERE p.risk_level = 'high')::int AS high_risk,
          COUNT(p.id) FILTER (WHERE p.risk_level = 'medium')::int AS medium_risk,
          COUNT(p.id) FILTER (WHERE p.risk_level = 'low')::int AS low_risk
        FROM counties c
        LEFT JOIN facilities f ON f.county_id = c.id AND f.is_active = TRUE
        LEFT JOIN patients p ON p.facility_id = f.id AND p.is_active = TRUE
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.name, c.code, c.is_active, c.created_at
        ORDER BY c.name
      `),
      db.query(`
      SELECT
        f.id, f.name, f.code, f.facility_type, f.operational_status, f.is_active,
        f.county_id, f.email, f.sms_activation,
        c.name AS county_name, c.code AS county_code,
        COUNT(p.id)::int AS patient_count,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'high')::int AS high_risk,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'medium')::int AS medium_risk,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'low')::int AS low_risk
      FROM facilities f
      LEFT JOIN counties c ON f.county_id = c.id
      LEFT JOIN patients p ON p.facility_id = f.id AND p.is_active = TRUE
      WHERE f.is_active = TRUE
      GROUP BY f.id, f.name, f.code, f.facility_type, f.operational_status, f.is_active,
        f.county_id, f.email, f.sms_activation, c.name, c.code
      ORDER BY c.name, f.name
      `),
    ]);
    const summary = {
      total_counties: countyCountResult.rows[0]?.total_counties || 0,
      total_facilities: facilityCountResult.rows[0]?.total_facilities || 0,
      total_patients: patientSummaryResult.rows[0]?.total_patients || 0,
      total_users: userCountResult.rows[0]?.total_users || 0,
      total_conversations: conversationSummaryResult.rows[0]?.total_conversations || 0,
      total_documents: documentCountResult.rows[0]?.total_documents || 0,
      high_risk_patients: patientSummaryResult.rows[0]?.high_risk_patients || 0,
      upcoming_appointments: patientSummaryResult.rows[0]?.upcoming_appointments || 0,
      messages_today: conversationSummaryResult.rows[0]?.messages_today || 0,
      new_patients_30d: patientSummaryResult.rows[0]?.new_patients_30d || 0,
    };

    const payload = {
      success: true,
      data: {
        summary,
        counties: countiesResult.rows,
        facilities: facilitiesResult.rows
      }
    };
    overviewCache = { expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS, payload };
    res.set('Cache-Control', 'private, max-age=10');
    res.json(payload);
  } catch (error) {
    console.error('Overview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/users-list
 * Returns all auth users
 */
router.get('/users-list', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        f.name AS facility_name,
        f.code AS facility_code,
        c.name AS county_name
      FROM auth_users u
      LEFT JOIN facilities f ON u.facility_id = f.id
      LEFT JOIN counties   c ON u.county_id   = c.id
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users
 * Create a new user (super admin only)
 */
router.post('/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { email, password, role, county_id } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Email, password, and role are required' });
    }

    // Validate role
    const validRoles = ['national', 'county'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be "national" or "county"' });
    }

    // County role requires county_id
    if (role === 'county' && !county_id) {
      return res.status(400).json({ success: false, error: 'County ID is required for county managers' });
    }

    // Check for existing user
    const existing = await db.query('SELECT id FROM auth_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const name = email.split('@')[0];

    const result = await db.query(
      `INSERT INTO auth_users (name, email, password_hash, role, county_id, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, name, email, role, county_id, is_active, created_at`,
      [name, email, passwordHash, role, role === 'county' ? county_id : null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user (super admin only)
 */
router.delete('/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM auth_users WHERE id = $1 RETURNING id, email', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/admin/facilities/:id/sms-activation
 * Toggle sms_activation on a facility (super admin only)
 */
router.patch('/facilities/:id/sms-activation', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { smsActivation } = req.body;

    if (typeof smsActivation !== 'boolean') {
      return res.status(400).json({ success: false, error: 'smsActivation must be a boolean' });
    }

    const result = await db.query(
      `UPDATE facilities SET sms_activation = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, sms_activation`,
      [smsActivation, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Toggle SMS activation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/counties-list
 * Returns all active counties (for dropdowns)
 */
router.get('/counties-list', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, code FROM counties WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
