// ================================================================
// PATIENTS API ROUTES
// ================================================================
// API endpoints for patient management with multi-facility support

import express from 'express';
import PatientDataService from '../services/patientData.js';
import AccessControlService from '../services/accessControl.js';
import db from '../config/database.js';
import {
  requireFacilityAccess,
  requirePatientAccess,
  auditDataAccess
} from '../middleware/authorization.js';

const router = express.Router();

/**
 * GET /api/patients
 * List patients with filtering (public endpoint for display)
 */
router.get('/', async (req, res) => {
  try {
    const {
      facility_id,
      risk_level,
      search,
      page = 1,
      limit = 25
    } = req.query;

    let whereClause = 'WHERE p.is_active = TRUE';
    const queryParams = [];
    let paramIndex = 1;

    // Add filters
    if (facility_id) {
      whereClause += ` AND p.facility_id = $${paramIndex}`;
      queryParams.push(facility_id);
      paramIndex++;
    }
    
    if (risk_level) {
      whereClause += ` AND p.risk_level = $${paramIndex}`;
      queryParams.push(risk_level);
      paramIndex++;
    }
    
    if (search) {
      whereClause += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.phone ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parseInt(limit), offset);

    const query = `
      SELECT 
        p.id,
        p.facility_id,
        f.name as facility_name,
        p.first_name || ' ' || p.last_name as patient_name,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.gender,
        p.phone,
        p.email,
        p.ccc_number,
        p.risk_level,
        p.enrollment_date,
        p.is_active as status,
        p.created_at
      FROM patients p
      LEFT JOIN facilities f ON p.facility_id = f.id
      ${whereClause}
      ORDER BY p.created_at DESC
      ${limitClause}
    `;

    const result = await db.query(query, queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM patients p
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2)); // Remove limit/offset params
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      count: result.rows.length,
      total: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: result.rows
    });
  } catch (error) {
    console.error('Error listing patients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * GET /api/patients/:facilityId/list
 * List patients in a specific facility
 */
router.get(
  '/facility/:facilityId/list',
  requireFacilityAccess,
  async (req, res) => {
    try {
      const filters = {
        gender: req.query.gender,
        patientStatus: req.query.status,
        searchTerm: req.query.search,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const patients = await PatientDataService.listFacilityPatients(
        req.facilityId,
        req.user.id,
        filters
      );

      res.json({
        success: true,
        count: patients.length,
        data: patients
      });
    } catch (error) {
      console.error('Error listing facility patients:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/patients/facilities
 * Returns all facilities for folder dropdown (must be before /:patientId route)
 */
router.get('/facilities', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        f.id as facility_id,
        f.name as facility_name,
        f.code,
        c.name as county_name,
        f.operational_status,
        COUNT(p.id) as patient_count,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'high') as high_risk,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'medium') as medium_risk,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'low') as low_risk,
        MAX(p.created_at) as last_sync_at
      FROM facilities f
      LEFT JOIN counties c ON f.county_id = c.id
      LEFT JOIN patients p ON f.id = p.facility_id AND p.is_active = TRUE
      WHERE f.is_active = TRUE
      GROUP BY f.id, f.name, f.code, c.name, f.operational_status
      ORDER BY f.name
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/patients/stats
 * Returns patient statistics (must be before /:patientId route)
 */
router.get('/stats', async (req, res) => {
  try {
    const facilityId = req.query.facility_id;
    
    let whereClause = 'WHERE p.is_active = TRUE';
    let queryParams = [];
    
    if (facilityId) {
      whereClause += ' AND p.facility_id = $1';
      queryParams.push(facilityId);
    }
    
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE p.risk_level = 'high') as high,
        COUNT(*) FILTER (WHERE p.risk_level = 'medium') as medium,
        COUNT(*) FILTER (WHERE p.risk_level = 'low') as low
      FROM patients p
      ${whereClause}
    `, queryParams);
    
    const stats = result.rows[0];
    
    res.json({
      success: true,
      data: {
        total: parseInt(stats.total),
        byRiskLevel: {
          HIGH: parseInt(stats.high),
          MEDIUM: parseInt(stats.medium), 
          LOW: parseInt(stats.low)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching patient stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/patients/:patientId
 * Get patient details
 */
router.get('/:patientId', requirePatientAccess, async (req, res) => {
  try {
    const patient = await PatientDataService.getPatient(req.patientId, req.user.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/patients/facility/:facilityId/create
 * Create new patient in facility
 */
router.post(
  '/facility/:facilityId/create',
  requireFacilityAccess,
  auditDataAccess('create', 'patients'),
  async (req, res) => {
    try {
      const patient = await PatientDataService.createPatient(
        req.facilityId,
        req.body,
        req.user.id
      );
      res.status(201).json({
        success: true,
        data: patient
      });
    } catch (error) {
      console.error('Error creating patient:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/patients/:patientId
 * Update patient information
 */
router.put(
  '/:patientId',
  requirePatientAccess,
  auditDataAccess('update', 'patients'),
  async (req, res) => {
    try {
      const patient = await PatientDataService.updatePatient(
        req.patientId,
        req.body,
        req.user.id
      );
      res.json({
        success: true,
        data: patient
      });
    } catch (error) {
      console.error('Error updating patient:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * POST /api/patients/:patientId/ccc
 * Add CCC number to patient
 */
router.post(
  '/:patientId/ccc',
  requirePatientAccess,
  auditDataAccess('create', 'patient_ccc_numbers'),
  async (req, res) => {
    try {
      const { cccNumber, enrollmentDate, facilityId } = req.body;

      if (!cccNumber || !enrollmentDate) {
        return res.status(400).json({
          error: 'cccNumber and enrollmentDate are required'
        });
      }

      const cccRecord = await PatientDataService.addCCCNumber(
        req.patientId,
        facilityId,
        cccNumber,
        enrollmentDate,
        req.user.id
      );

      res.status(201).json({
        success: true,
        data: cccRecord
      });
    } catch (error) {
      console.error('Error adding CCC number:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/patients/search/ccc/:cccNumber
 * Get patient by CCC number
 */
router.get('/search/ccc/:cccNumber', async (req, res) => {
  try {
    const patient = await PatientDataService.getPatientByCCC(
      req.params.cccNumber,
      req.user.id
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Error searching patient by CCC:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/patients/:facilityId/report
 * Get patient report for date range
 */
router.get(
  '/facility/:facilityId/report',
  requireFacilityAccess,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'startDate and endDate query parameters are required'
        });
      }

      const patients = await PatientDataService.getPatientsForReport(
        req.facilityId,
        startDate,
        endDate,
        req.user.id
      );

      res.json({
        success: true,
        count: patients.length,
        facility_id: req.facilityId,
        date_range: { startDate, endDate },
        data: patients
      });
    } catch (error) {
      console.error('Error generating patient report:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;

