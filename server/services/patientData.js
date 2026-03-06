// ================================================================
// PATIENT DATA SERVICE
// ================================================================
// Manages patient records with multi-facility support and CCC number handling

import db from '../config/database.js';
import AccessControlService from './accessControl.js';

class PatientDataService {
  /**
   * Create patient record
   */
  static async createPatient(facilityId, patientData, createdByUserId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify user access to facility
      const hasAccess = await AccessControlService.canAccessFacility(createdByUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        email,
        nationalId,
        bloodGroup,
        chronicConditions,
        allergies,
        emergencyContactName,
        emergencyContactPhone
      } = patientData;

      // Create patient
      const patientQuery = `
        INSERT INTO patients (
          facility_id, first_name, last_name, date_of_birth, gender,
          phone, email, national_id, blood_group,
          chronic_conditions, allergies,
          emergency_contact_name, emergency_contact_phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const result = await client.query(patientQuery, [
        facilityId,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone || null,
        email || null,
        nationalId || null,
        bloodGroup || null,
        JSON.stringify(chronicConditions || []),
        JSON.stringify(allergies || []),
        emergencyContactName || null,
        emergencyContactPhone || null
      ]);

      const patient = result.rows[0];

      // Log audit
      await client.query(`
        INSERT INTO facility_data_audit (facility_id, user_id, operation_type, table_name, record_id, new_values)
        VALUES ($1, $2, 'create', 'patients', $3, $4)
      `, [
        facilityId,
        createdByUserId,
        patient.id,
        JSON.stringify(patient)
      ]);

      await client.query('COMMIT');
      return patient;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get patient details
   */
  static async getPatient(patientId, requestingUserId) {
    try {
      // Check access to patient
      const hasAccess = await AccessControlService.canAccessPatient(requestingUserId, patientId);
      if (!hasAccess) {
        throw new Error('You do not have access to this patient');
      }

      const query = `
        SELECT 
          p.id,
          p.facility_id,
          f.name as facility_name,
          f.code as facility_code,
          p.first_name,
          p.last_name,
          p.date_of_birth,
          p.gender,
          p.phone,
          p.email,
          p.national_id,
          p.blood_group,
          p.chronic_conditions,
          p.allergies,
          p.current_medications,
          p.emergency_contact_name,
          p.emergency_contact_phone,
          p.is_active,
          p.created_at,
          p.updated_at,
          (SELECT json_agg(row_to_json(pcn.*))
           FROM patient_ccc_numbers pcn
           WHERE pcn.patient_id = p.id) as ccc_numbers
        FROM patients p
        LEFT JOIN facilities f ON p.facility_id = f.id
        WHERE p.id = $1
      `;

      const result = await db.query(query, [patientId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * List patients for facility
   */
  static async listFacilityPatients(facilityId, requestingUserId, filters = {}) {
    try {
      // Check access
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      let query = `
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          p.date_of_birth,
          p.gender,
          p.phone,
          p.email,
          p.national_id,
          p.is_active,
          p.patient_status,
          p.created_at,
          (SELECT json_agg(row_to_json(pcn.*))
           FROM patient_ccc_numbers pcn
           WHERE pcn.patient_id = p.id AND pcn.is_primary = TRUE) as primary_ccc
        FROM patients p
        WHERE p.facility_id = $1
      `;

      const params = [facilityId];
      let paramIndex = 2;

      // Apply filters
      if (filters.gender) {
        query += ` AND p.gender = $${paramIndex}`;
        params.push(filters.gender);
        paramIndex++;
      }

      if (filters.patientStatus) {
        query += ` AND p.patient_status = $${paramIndex}`;
        params.push(filters.patientStatus);
        paramIndex++;
      }

      if (filters.searchTerm) {
        query += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.phone = $${paramIndex})`;
        const searchTerm = `%${filters.searchTerm}%`;
        params.push(searchTerm, searchTerm, filters.searchTerm);
        paramIndex += 3;
      }

      // Pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update patient record
   */
  static async updatePatient(patientId, patientData, requestingUserId) {
    try {
      // Check access
      const hasAccess = await AccessControlService.canAccessPatient(requestingUserId, patientId);
      if (!hasAccess) {
        throw new Error('You do not have access to this patient');
      }

      const {
        phone,
        email,
        bloodGroup,
        chronicConditions,
        allergies,
        currentMedications,
        emergencyContactName,
        emergencyContactPhone,
        residentialAddress
      } = patientData;

      const query = `
        UPDATE patients
        SET
          phone = COALESCE($1, phone),
          email = COALESCE($2, email),
          blood_group = COALESCE($3, blood_group),
          chronic_conditions = COALESCE($4, chronic_conditions),
          allergies = COALESCE($5, allergies),
          current_medications = COALESCE($6, current_medications),
          emergency_contact_name = COALESCE($7, emergency_contact_name),
          emergency_contact_phone = COALESCE($8, emergency_contact_phone),
          residential_address = COALESCE($9, residential_address),
          updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `;

      const result = await db.query(query, [
        phone || null,
        email || null,
        bloodGroup || null,
        chronicConditions ? JSON.stringify(chronicConditions) : null,
        allergies ? JSON.stringify(allergies) : null,
        currentMedications ? JSON.stringify(currentMedications) : null,
        emergencyContactName || null,
        emergencyContactPhone || null,
        residentialAddress || null,
        patientId
      ]);

      const patient = result.rows[0];

      // Log audit
      await AccessControlService.logDataAccess(
        requestingUserId,
        patient.facility_id,
        'update',
        'patients',
        patientId,
        patientData
      );

      return patient;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add CCC number to patient
   */
  static async addCCCNumber(patientId, facilityId, cccNumber, enrollmentDate, requestingUserId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check access
      const hasAccess = await AccessControlService.canAccessPatient(requestingUserId, patientId);
      if (!hasAccess) {
        throw new Error('You do not have access to this patient');
      }

      // Check CCC number uniqueness
      const cccCheck = await client.query(
        'SELECT id FROM patient_ccc_numbers WHERE ccc_number = $1',
        [cccNumber]
      );
      if (cccCheck.rows.length > 0) {
        throw new Error('CCC number already exists');
      }

      // Add CCC number
      const query = `
        INSERT INTO patient_ccc_numbers (
          patient_id, facility_id, ccc_number, enrollment_date, is_primary
        ) VALUES ($1, $2, $3, $4, 
          NOT EXISTS (SELECT 1 FROM patient_ccc_numbers WHERE patient_id = $1)
        )
        RETURNING *
      `;

      const result = await client.query(query, [patientId, facilityId, cccNumber, enrollmentDate]);
      const cccRecord = result.rows[0];

      // Log audit
      await client.query(`
        INSERT INTO facility_data_audit (facility_id, user_id, operation_type, table_name, record_id, new_values)
        VALUES ($1, $2, 'create', 'patient_ccc_numbers', $3, $4)
      `, [
        facilityId,
        requestingUserId,
        cccRecord.id,
        JSON.stringify(cccRecord)
      ]);

      await client.query('COMMIT');
      return cccRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get patient by CCC number (useful for clinic lookups)
   */
  static async getPatientByCCC(cccNumber, requestingUserId) {
    try {
      const query = `
        SELECT 
          p.id,
          p.facility_id,
          f.name as facility_name,
          p.first_name,
          p.last_name,
          p.date_of_birth,
          p.phone,
          pcn.ccc_number,
          pcn.enrollment_date
        FROM patient_ccc_numbers pcn
        INNER JOIN patients p ON pcn.patient_id = p.id
        INNER JOIN facilities f ON p.facility_id = f.id
        WHERE pcn.ccc_number = $1
      `;

      const result = await db.query(query, [cccNumber]);
      if (result.rows.length === 0) {
        return null;
      }

      const patient = result.rows[0];

      // Check access
      const hasAccess = await AccessControlService.canAccessPatient(requestingUserId, patient.id);
      if (!hasAccess) {
        throw new Error('You do not have access to this patient');
      }

      return patient;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get patients by facility and date range (for reports)
   */
  static async getPatientsForReport(facilityId, startDate, endDate, requestingUserId) {
    try {
      // Check access
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const query = `
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          p.gender,
          p.date_of_birth,
          p.patient_status,
          (SELECT json_agg(pcn.ccc_number)
           FROM patient_ccc_numbers pcn
           WHERE pcn.patient_id = p.id) as ccc_numbers,
          p.created_at
        FROM patients p
        WHERE p.facility_id = $1
          AND p.created_at BETWEEN $2 AND $3
        ORDER BY p.created_at DESC
      `;

      const result = await db.query(query, [facilityId, startDate, endDate]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

export default PatientDataService;
