// ================================================================
// PATIENTS API ROUTES
// ================================================================
// API endpoints for patient management with multi-facility support

import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import PatientDataService from '../services/patientData.js';
import AccessControlService from '../services/accessControl.js';
import db from '../config/database.js';
import {
  requireFacilityAccess,
  requirePatientAccess,
  auditDataAccess
} from '../middleware/authorization.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';

// Multer config for CSV uploads (memory storage, 10MB max)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

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
      whereClause += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.phone ILIKE $${paramIndex} OR p.ccc_number ILIKE $${paramIndex})`;
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
        p.next_appointment_date,
        p.appointment_status,
        p.last_visit_date,
        p.last_viral_load,
        p.county,
        p.sub_county,
        p.ward,
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

// ================================================================
// DELETE /api/patients/bulk-delete
// Delete multiple patients by ID (admin only)
// ================================================================
router.delete(
  '/bulk-delete',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids array is required' });
      }

      // Soft-delete by setting is_active = FALSE
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const result = await db.query(
        `UPDATE patients SET is_active = FALSE, updated_at = NOW() WHERE id IN (${placeholders}) AND is_active = TRUE`,
        ids
      );

      res.json({
        success: true,
        deleted: result.rowCount,
      });
    } catch (error) {
      console.error('Error bulk-deleting patients:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ================================================================
// POST /api/patients/upload-csv
// Bulk import patients from CSV file (admin only)
// ================================================================
router.post(
  '/upload-csv',
  authenticateToken,
  requireSuperAdmin,
  csvUpload.single('file'),
  async (req, res) => {
    const client = await db.pool.connect();
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No CSV file uploaded' });
      }

      // Parse CSV from buffer
      const csvContent = req.file.buffer.toString('utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });

      if (!records.length) {
        return res.status(400).json({ success: false, error: 'CSV file is empty' });
      }

      await client.query('BEGIN');

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        try {
          // --- Resolve facility by MFL code ---
          const facilityMfl = (row.facility_mfl || '').trim();
          const facilityName = (row.facility_name || '').trim();
          let facilityId = null;

          if (facilityMfl) {
            const facResult = await client.query(
              'SELECT id FROM facilities WHERE code = $1 AND is_active = TRUE LIMIT 1',
              [facilityMfl]
            );
            if (facResult.rows.length > 0) {
              facilityId = facResult.rows[0].id;
            }
          }

          // If not found by code, try by name
          if (!facilityId && facilityName) {
            const facResult = await client.query(
              'SELECT id FROM facilities WHERE LOWER(name) = LOWER($1) AND is_active = TRUE LIMIT 1',
              [facilityName]
            );
            if (facResult.rows.length > 0) {
              facilityId = facResult.rows[0].id;
            }
          }

          // --- Parse patient name ---
          const fullName = (row.patient_name || '').trim();
          const nameParts = fullName.split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          // --- Normalize phone ---
          let phone = (row.phone_number || '').trim().replace(/\s+/g, '');
          if (phone.startsWith('+2547')) {
            phone = '0' + phone.slice(4);
          }

          // --- Normalize CCC number ---
          const cccNumber = (row.ccc_number || '').trim().replace(/[-.]/g, '');

          // --- Parse dates ---
          const dob = row.dob ? row.dob.trim() : null;
          const visitDate = row.visit_date ? row.visit_date.trim() : null;
          const appointmentDate = row.appointment_date ? row.appointment_date.trim() : null;

          // --- Parse risk ---
          const riskClassification = (row.risk_classification || 'Unknown').trim();
          let riskLevel = 'unknown';
          if (/high/i.test(riskClassification)) riskLevel = 'high';
          else if (/medium/i.test(riskClassification)) riskLevel = 'medium';
          else if (/low/i.test(riskClassification)) riskLevel = 'low';

          const riskScore = row.risk_classification_value
            ? parseFloat(row.risk_classification_value) || null
            : null;

          // --- Parse other fields ---
          const gender = (row.gender || '').trim().toUpperCase() || null;
          const age = row.age ? parseInt(row.age, 10) || null : null;
          const lastViralLoad = (row.last_viral_load || '').trim() || null;
          const appointmentStatus = (row.appointment_status || 'Pending').trim();
          const county = (row.county || '').trim() || null;
          const subCounty = (row.sub_county || '').trim() || null;
          const ward = (row.ward || '').trim() || null;
          const cityVillage = (row.city_village || '').trim() || null;
          const landmark = (row.landmark || '').trim() || null;
          const address5 = (row.address5 || '').trim() || null;
          const address6 = (row.address6 || '').trim() || null;
          const maritalStatus = (row.marital_status || '').trim() || null;
          const caseManager = (row.case_manager_assigned || '').trim() || null;
          const externalId = row.patient_id ? parseInt(row.patient_id, 10) || null : null;
          const riskFactors = (row.risk_factors || '').trim() || null;

          // --- Upsert: match by ccc_number (primary key for dedup) ---
          if (!cccNumber) {
            skipped++;
            errors.push({ row: i + 2, reason: 'Missing ccc_number' });
            continue;
          }

          const existing = await client.query(
            'SELECT id FROM patients WHERE ccc_number = $1 LIMIT 1',
            [cccNumber]
          );

          if (existing.rows.length > 0) {
            // UPDATE existing patient
            await client.query(`
              UPDATE patients SET
                facility_id = COALESCE($1, facility_id),
                first_name = COALESCE(NULLIF($2, ''), first_name),
                last_name = COALESCE(NULLIF($3, ''), last_name),
                gender = COALESCE(NULLIF($4, ''), gender),
                date_of_birth = COALESCE($5::DATE, date_of_birth),
                phone = COALESCE(NULLIF($6, ''), phone),
                risk_level = $7,
                next_appointment_date = COALESCE($8::TIMESTAMPTZ, next_appointment_date),
                external_patient_id = COALESCE($9, external_patient_id),
                last_visit_date = COALESCE($10::DATE, last_visit_date),
                age = COALESCE($11, age),
                risk_score = COALESCE($12, risk_score),
                risk_factors = COALESCE(NULLIF($13, ''), risk_factors),
                last_viral_load = COALESCE(NULLIF($14, ''), last_viral_load),
                appointment_status = COALESCE(NULLIF($15, ''), appointment_status),
                county = COALESCE(NULLIF($16, ''), county),
                sub_county = COALESCE(NULLIF($17, ''), sub_county),
                ward = COALESCE(NULLIF($18, ''), ward),
                city_village = COALESCE(NULLIF($19, ''), city_village),
                landmark = COALESCE(NULLIF($20, ''), landmark),
                address5 = COALESCE(NULLIF($21, ''), address5),
                address6 = COALESCE(NULLIF($22, ''), address6),
                marital_status = COALESCE(NULLIF($23, ''), marital_status),
                case_manager = COALESCE(NULLIF($24, ''), case_manager),
                updated_at = NOW()
              WHERE ccc_number = $25
            `, [
              facilityId, firstName, lastName, gender, dob, phone,
              riskLevel, appointmentDate, externalId, visitDate,
              age, riskScore, riskFactors, lastViralLoad,
              appointmentStatus, county, subCounty, ward,
              cityVillage, landmark, address5, address6,
              maritalStatus, caseManager, cccNumber
            ]);
            updated++;
          } else {
            // INSERT new patient
            await client.query(`
              INSERT INTO patients (
                facility_id, ccc_number, first_name, last_name, gender,
                date_of_birth, phone, risk_level, next_appointment_date,
                external_patient_id, last_visit_date, age, risk_score,
                risk_factors, last_viral_load, appointment_status,
                county, sub_county, ward, city_village, landmark,
                address5, address6, marital_status, case_manager,
                is_active
              ) VALUES (
                $1, $2, $3, $4, $5, $6::DATE, $7, $8, $9::TIMESTAMPTZ,
                $10, $11::DATE, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25,
                TRUE
              )
            `, [
              facilityId, cccNumber, firstName, lastName, gender,
              dob, phone, riskLevel, appointmentDate,
              externalId, visitDate, age, riskScore,
              riskFactors, lastViralLoad, appointmentStatus,
              county, subCounty, ward, cityVillage, landmark,
              address5, address6, maritalStatus, caseManager
            ]);
            created++;
          }
        } catch (rowErr) {
          skipped++;
          errors.push({ row: i + 2, reason: rowErr.message });
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        summary: {
          totalRows: records.length,
          created,
          updated,
          skipped,
        },
        errors: errors.slice(0, 50), // Return first 50 errors max
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('CSV upload error:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  }
);

export default router;
