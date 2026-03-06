// ================================================================
// ADMIN DASHBOARD API ROUTES
// ================================================================
// API endpoints for super admin dashboard and centralized reporting

import express from 'express';
import AccessControlService from '../services/accessControl.js';
import db from '../config/database.js';
import { requireSuperAdmin, requireCountyAdmin, requireCountyAdminOrAbove } from '../middleware/authorization.js';

const router = express.Router();

/**
 * GET /api/admin/dashboard
 * Super admin dashboard with all facilities and data
 */
router.get('/dashboard', requireSuperAdmin, async (req, res) => {
  try {

    // Get summary statistics
    const summaryQuery = `
      SELECT
        (SELECT COUNT(*) FROM facilities WHERE is_active = TRUE) as total_facilities,
        (SELECT COUNT(*) FROM counties WHERE is_active = TRUE) as total_counties,
        (SELECT COUNT(*) FROM patients) as total_patients,
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as total_users,
        (SELECT COUNT(*) FROM patient_ccc_numbers WHERE enrollment_status = 'active') as active_ccc_enrollment,
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
        COUNT(DISTINCT pcn.id) as ccc_enrollment_count,
        (SELECT COUNT(*) FROM users WHERE facility_id = f.id AND is_active = TRUE) as active_staff,
        (SELECT created_at FROM data_sync_log WHERE facility_id = f.id ORDER BY created_at DESC LIMIT 1) as last_sync
      FROM facilities f
      LEFT JOIN counties c ON f.county_id = c.id
      LEFT JOIN patients p ON f.id = p.facility_id
      LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id
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
        (SELECT COUNT(*) FROM users WHERE county_id = c.id AND is_active = TRUE) as active_admins
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
router.get('/county/:countyId/dashboard', requireCountyAdmin, async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify user has access to this county
    const accessibleCounties = await AccessControlService.getUserAccessibleCounties(userId);
    const hasAccess = accessibleCounties.some(c => c.id === req.params.countyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this county' });
    }

    // Get county summary
    const summaryQuery = `
      SELECT
        c.name,
        c.code,
        COUNT(DISTINCT f.id) as facility_count,
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT pcn.id) as active_ccc_enrollment,
        COUNT(DISTINCT u.id) as active_staff
      FROM counties c
      LEFT JOIN facilities f ON c.id = f.county_id
      LEFT JOIN patients p ON f.id = p.facility_id
      LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id AND pcn.enrollment_status = 'active'
      LEFT JOIN users u ON f.id = u.facility_id AND u.is_active = TRUE
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.code
    `;

    const summaryResult = await db.query(summaryQuery, [req.params.countyId]);

    // Get facilities in county
    const facilitiesQuery = `
      SELECT
        f.id,
        f.name,
        f.code,
        f.facility_type,
        f.operational_status,
        COUNT(DISTINCT p.id) as patient_count,
        COUNT(DISTINCT pcn.id) as ccc_enrollment_count,
        (SELECT COUNT(*) FROM users WHERE facility_id = f.id AND is_active = TRUE) as active_staff
      FROM facilities f
      LEFT JOIN patients p ON f.id = p.facility_id
      LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id
      WHERE f.county_id = $1
      GROUP BY f.id, f.name, f.code, f.facility_type, f.operational_status
      ORDER BY f.name
    `;

    const facilitiesResult = await db.query(facilitiesQuery, [req.params.countyId]);

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
 * Get centralized patient data for all accessible facilities
 */
router.get('/facilities-data', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get accessible facilities
    const accessibleFacilities = await AccessControlService.getUserAccessibleFacilities(userId);

    if (accessibleFacilities.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const facilityIds = accessibleFacilities.map(f => f.id);

    // Export patient data
    const query = `
      SELECT
        p.id,
        p.facility_id,
        f.name as facility_name,
        f.code as facility_code,
        c.name as county_name,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.gender,
        p.phone,
        p.email,
        p.national_id,
        p.blood_group,
        p.patient_status,
        string_agg(DISTINCT pcn.ccc_number, ', ') as ccc_numbers,
        p.created_at
      FROM patients p
      INNER JOIN facilities f ON p.facility_id = f.id
      INNER JOIN counties c ON f.county_id = c.id
      LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id
      WHERE p.facility_id = ANY($1)
      GROUP BY p.id, f.name, f.code, c.name
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query, [facilityIds]);

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
 * Get centralized audit log
 */
router.get('/audit-log', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get accessible facilities
    const accessibleFacilities = await AccessControlService.getUserAccessibleFacilities(userId);

    if (accessibleFacilities.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const facilityIds = accessibleFacilities.map(f => f.id);
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const query = `
      SELECT
        fda.id,
        fda.facility_id,
        f.name as facility_name,
        u.email as user_email,
        u.first_name,
        u.last_name,
        fda.operation_type,
        fda.table_name,
        fda.record_id,
        fda.created_at
      FROM facility_data_audit fda
      LEFT JOIN facilities f ON fda.facility_id = f.id
      LEFT JOIN users u ON fda.user_id = u.id
      WHERE fda.facility_id = ANY($1)
      ORDER BY fda.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [facilityIds, limit, offset]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/sync-status
 * Get sync status for all facilities
 */
router.get('/sync-status', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get accessible facilities
    const accessibleFacilities = await AccessControlService.getUserAccessibleFacilities(userId);

    if (accessibleFacilities.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const facilityIds = accessibleFacilities.map(f => f.id);

    const query = `
      SELECT DISTINCT ON (facility_id)
        facility_id,
        sync_type,
        sync_status,
        records_synced,
        created_at
      FROM data_sync_log
      WHERE facility_id = ANY($1)
      ORDER BY facility_id, created_at DESC
    `;

    const result = await db.query(query, [facilityIds]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
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
        f.county_id,
        c.name AS county_name, c.code AS county_code,
        (SELECT COUNT(*) FROM patients WHERE facility_id = f.id) AS patient_count,
        (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur WHERE ur.facility_id = f.id) AS staff_count
      FROM facilities f
      LEFT JOIN counties c ON f.county_id = c.id
      ORDER BY c.name, f.name
    `);

    const summaryResult = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM counties  WHERE is_active = TRUE) AS total_counties,
        (SELECT COUNT(*) FROM facilities WHERE is_active = TRUE) AS total_facilities,
        (SELECT COUNT(*) FROM patients)                          AS total_patients,
        (SELECT COUNT(*) FROM users     WHERE is_active = TRUE) AS total_users
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
 * Returns all users with their assigned roles
 */
router.get('/users-list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        (u.first_name || ' ' || u.last_name) AS name,
        u.email,
        u.job_title,
        u.is_active,
        u.created_at,
        MAX(f.name)  AS facility_name,
        MAX(f.code)  AS facility_code,
        MAX(c.name)  AS county_name,
        COALESCE(
          json_agg(r.name ORDER BY r.hierarchy_level DESC) FILTER (WHERE r.name IS NOT NULL),
          '[]'
        ) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles      r  ON ur.role_id = r.id
      LEFT JOIN facilities f  ON ur.facility_id = f.id
      LEFT JOIN counties   c  ON ur.county_id   = c.id
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.job_title, u.is_active, u.created_at
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
