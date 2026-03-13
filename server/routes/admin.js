// ================================================================
// ADMIN DASHBOARD API ROUTES
// ================================================================
// API endpoints for super admin dashboard and centralized reporting

import express from 'express';
import db from '../config/database.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

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
    const countiesResult = await db.query(`
      SELECT id, name, code, is_active, created_at FROM counties ORDER BY name
    `);

    const facilitiesResult = await db.query(`
      SELECT
        f.id, f.name, f.code, f.facility_type, f.operational_status, f.is_active,
        f.county_id, f.email,
        c.name AS county_name, c.code AS county_code,
        (SELECT COUNT(*) FROM patients WHERE facility_id = f.id) AS patient_count
      FROM facilities f
      LEFT JOIN counties c ON f.county_id = c.id
      ORDER BY c.name, f.name
    `);

    const summaryResult = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM counties  WHERE is_active = TRUE) AS total_counties,
        (SELECT COUNT(*) FROM facilities WHERE is_active = TRUE) AS total_facilities,
        (SELECT COUNT(*) FROM patients)                          AS total_patients,
        (SELECT COUNT(*) FROM auth_users WHERE is_active = TRUE) AS total_users,
        (SELECT COUNT(*) FROM conversations)                     AS total_conversations,
        (SELECT COUNT(*) FROM documents)                         AS total_documents,
        (SELECT COUNT(*) FROM patients WHERE risk_level = 'high') AS high_risk_patients,
        (SELECT COUNT(*) FROM patients WHERE next_appointment_date >= CURRENT_DATE AND next_appointment_date < CURRENT_DATE + INTERVAL '7 days') AS upcoming_appointments,
        (SELECT COUNT(*) FROM conversations WHERE created_at >= NOW() - INTERVAL '24 hours') AS messages_today,
        (SELECT COUNT(*) FROM patients WHERE created_at >= NOW() - INTERVAL '30 days') AS new_patients_30d
    `);

    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        counties: countiesResult.rows,
        facilities: facilitiesResult.rows
      }
    });
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

export default router;
