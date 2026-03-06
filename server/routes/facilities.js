// ================================================================
// FACILITIES API ROUTES
// ================================================================
// API endpoints for facility management with RBAC

import express from 'express';
import FacilityService from '../services/facilityManagement.js';
import AccessControlService from '../services/accessControl.js';
import {
  requireFacilityAccess,
  requireCountyAdmin,
  requireSuperAdmin,
  auditDataAccess
} from '../middleware/authorization.js';

const router = express.Router();

// Middleware to verify facility API key
const verifyFacilityKey = (req, res, next) => {
  const apiKey = req.headers['x-facility-api-key'];
  const facilityId = req.headers['x-facility-id'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing X-Facility-API-Key header'
    });
  }

  if (!facilityId) {
    return res.status(401).json({
      success: false,
      error: 'Missing X-Facility-ID header'
    });
  }

  // TODO: Validate API key against a facilities table in production
  req.facilityId = facilityId;
  next();
};

router.use(verifyFacilityKey);

// ──────────────────────────────────────────────────────────────
// POST /api/facilities/sync
//
// Single endpoint the facility cron job calls.
// Accepts patients and their appointments in one payload.
// Patients are upserted first, then appointments are linked.
//
// Headers:
//   X-Facility-API-Key: <your-api-key>
//   X-Facility-ID: <your-facility-id>
//   Content-Type: application/json
//
// Request Body:
// {
//   "patients": [
//     {
//       "patient_id": "EXT-001",
//       "phone_number": "+254712345678",
//       "patient_name": "Jane Doe",
//       "email": "jane@example.com",
//       "risk_level": "HIGH",
//       "status": "active",
//       "appointments": [
//         {
//           "appointment_id": "APT-001",
//           "appointment_date": "2026-03-15T09:00:00Z",
//           "appointment_type": "checkup",
//           "status": "scheduled",
//           "notes": "Routine follow-up"
//         }
//       ]
//     }
//   ]
// }
// ──────────────────────────────────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    const { patients, facility_name } = req.body;

    if (!patients || !Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({
        success: false,
        error: '"patients" must be a non-empty array'
      });
    }

    const facilityId = req.facilityId;

    // Auto-register / update the facility
    await query(
      `INSERT INTO facilities (facility_id, facility_name, last_sync_at)
       VALUES ($1, $2, now())
       ON CONFLICT (facility_id) DO UPDATE
       SET last_sync_at = now(),
           facility_name = COALESCE(EXCLUDED.facility_name, facilities.facility_name),
           updated_at = now()`,
      [facilityId, facility_name || facilityId]
    );

    const patientResults = [];
    let totalAppointments = 0;
    let appointmentsCreated = 0;

    for (const patient of patients) {
      const {
        patient_id,
        phone_number,
        patient_name,
        email,
        risk_level = 'MEDIUM',
        status = 'active',
        appointments: patientAppointments = []
      } = patient;

      // --- Validate required fields ---
      if (!patient_id || !phone_number) {
        patientResults.push({
          patient_id,
          success: false,
          error: 'patient_id and phone_number are required'
        });
        continue;
      }

      // --- Upsert patient ---
      let patientUUID;
      try {
        const result = await query(
          `INSERT INTO patients 
             (phone_number, facility_id, patient_name, email, risk_level, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (phone_number) DO UPDATE 
           SET patient_name  = COALESCE(EXCLUDED.patient_name, patients.patient_name),
               email         = COALESCE(EXCLUDED.email, patients.email),
               risk_level    = EXCLUDED.risk_level,
               status        = EXCLUDED.status,
               facility_id   = EXCLUDED.facility_id,
               updated_at    = now()
           RETURNING id`,
          [
            phone_number,
            facilityId,
            patient_name || null,
            email || null,
            risk_level,
            status,
            JSON.stringify({ external_id: patient_id })
          ]
        );
        patientUUID = result.rows[0].id;
      } catch (err) {
        console.error(`[sync] Error upserting patient ${patient_id}:`, err.message);
        patientResults.push({
          patient_id,
          success: false,
          error: err.message
        });
        continue;
      }

      // --- Upsert appointments ---
      const appointmentResults = [];

      for (const apt of patientAppointments) {
        totalAppointments++;
        const {
          appointment_id,
          appointment_date,
          appointment_type,
          status: aptStatus = 'scheduled',
          notes
        } = apt;

        if (!appointment_id || !appointment_date) {
          appointmentResults.push({
            appointment_id,
            success: false,
            error: 'appointment_id and appointment_date are required'
          });
          continue;
        }

        try {
          const aptResult = await query(
            `INSERT INTO appointments 
               (patient_id, facility_id, appointment_date, appointment_type, status, notes, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (patient_id, appointment_date) DO UPDATE 
             SET status           = EXCLUDED.status,
                 appointment_type = EXCLUDED.appointment_type,
                 notes            = COALESCE(EXCLUDED.notes, appointments.notes),
                 updated_at       = now()
             RETURNING id`,
            [
              patientUUID,
              facilityId,
              appointment_date,
              appointment_type || null,
              aptStatus,
              notes || null,
              JSON.stringify({ external_id: appointment_id })
            ]
          );

          appointmentsCreated++;
          appointmentResults.push({
            appointment_id,
            success: true,
            id: aptResult.rows[0].id
          });
        } catch (err) {
          console.error(`[sync] Error upserting appointment ${appointment_id}:`, err.message);
          appointmentResults.push({
            appointment_id,
            success: false,
            error: err.message
          });
        }
      }

      patientResults.push({
        patient_id,
        phone_number,
        success: true,
        id: patientUUID,
        appointments: appointmentResults.length > 0 ? appointmentResults : undefined
      });
    }

    res.json({
      success: true,
      facility_id: facilityId,
      summary: {
        patients_sent: patients.length,
        patients_ok: patientResults.filter(p => p.success).length,
        appointments_sent: totalAppointments,
        appointments_ok: appointmentsCreated
      },
      results: patientResults
    });
  } catch (error) {
    console.error('[sync] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/facilities/status
 * Quick health-check for the facility developer to verify their credentials work.
 */
router.get('/status', async (req, res) => {
  res.json({
    success: true,
    facility_id: req.facilityId,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/facilities/sync',
    message: 'Facility integration is active'
  });
});

export default router;
