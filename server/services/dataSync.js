// ================================================================
// DATA SYNC SERVICE
// ================================================================
// Handles data synchronization from facility databases to central database
// Supports real-time, incremental, and full sync modes

import db from '../config/database.js';
import FacilityService from './facilityManagement.js';
import crypto from 'crypto';

class DataSyncService {
  /**
   * Log sync operation
   */
  static async logSyncOperation(facilityId, syncType, tableName, recordsSynced, status, error = null) {
    try {
      const query = `
        INSERT INTO data_sync_log (
          facility_id, sync_type, table_name, records_synced, sync_status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await db.query(query, [
        facilityId,
        syncType,
        tableName,
        recordsSynced,
        status,
        error || null
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error logging sync operation:', error);
      throw error;
    }
  }

  /**
   * Sync patient data from facility
   * Called when facility pushes data to central database
   */
  static async syncPatientData(facilityId, facilityAPIKey, patientData) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify facility API key
      const isValid = await FacilityService.verifyFacilityAPIKey(facilityId, facilityAPIKey);
      if (!isValid) {
        throw new Error('Invalid facility or API key');
      }

      const {
        status: syncType = 'incremental',
        patients = []
      } = patientData;

      let synced = 0;
      const syncErrors = [];

      // Process each patient record
      for (const patientRecord of patients) {
        try {
          const {
            externalId,
            firstName,
            lastName,
            dateOfBirth,
            gender,
            phone,
            email,
            nationalId,
            cccNumber,
            enrollmentDate,
            bloodGroup,
            chronicConditions,
            allergies,
            currentMedications
          } = patientRecord;

          // Check if patient exists by national_id and facility
          let patientQuery = `
            SELECT id FROM patients
            WHERE facility_id = $1 AND national_id = $2
          `;

          let result = await client.query(patientQuery, [facilityId, nationalId]);
          let patientId;

          if (result.rows.length > 0) {
            // Update existing patient
            patientId = result.rows[0].id;
            const updateQuery = `
              UPDATE patients
              SET
                first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                phone = COALESCE($3, phone),
                email = COALESCE($4, email),
                blood_group = COALESCE($5, blood_group),
                chronic_conditions = COALESCE($6, chronic_conditions),
                allergies = COALESCE($7, allergies),
                current_medications = COALESCE($8, current_medications),
                updated_at = NOW()
              WHERE id = $9
            `;

            await client.query(updateQuery, [
              firstName,
              lastName,
              phone || null,
              email || null,
              bloodGroup || null,
              chronicConditions ? JSON.stringify(chronicConditions) : null,
              allergies ? JSON.stringify(allergies) : null,
              currentMedications ? JSON.stringify(currentMedications) : null,
              patientId
            ]);
          } else {
            // Create new patient
            const insertQuery = `
              INSERT INTO patients (
                facility_id, first_name, last_name, date_of_birth, gender,
                phone, email, national_id, blood_group,
                chronic_conditions, allergies, current_medications
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              RETURNING id
            `;

            const insertResult = await client.query(insertQuery, [
              facilityId,
              firstName,
              lastName,
              dateOfBirth,
              gender,
              phone || null,
              email || null,
              nationalId || null,
              bloodGroup || null,
              chronicConditions ? JSON.stringify(chronicConditions) : null,
              allergies ? JSON.stringify(allergies) : null,
              currentMedications ? JSON.stringify(currentMedications) : null
            ]);

            patientId = insertResult.rows[0].id;
          }

          // Add or update CCC number if provided
          if (cccNumber && enrollmentDate) {
            const cccCheckQuery = `
              SELECT id FROM patient_ccc_numbers
              WHERE ccc_number = $1
            `;

            const cccResult = await client.query(cccCheckQuery, [cccNumber]);

            if (cccResult.rows.length === 0) {
              // Add CCC number (only as secondary if patient already has primary CCC)
              const cccInsertQuery = `
                INSERT INTO patient_ccc_numbers (
                  patient_id, facility_id, ccc_number, enrollment_date, is_primary
                ) VALUES ($1, $2, $3, $4, 
                  NOT EXISTS (SELECT 1 FROM patient_ccc_numbers WHERE patient_id = $1 AND is_primary = TRUE)
                )
              `;

              await client.query(cccInsertQuery, [
                patientId,
                facilityId,
                cccNumber,
                enrollmentDate
              ]);
            }
          }

          synced++;
        } catch (error) {
          syncErrors.push({
            patientExternalId: patientRecord.externalId,
            error: error.message
          });
        }
      }

      // Log sync operation
      const dataHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(patientData))
        .digest('hex');

      await client.query(`
        INSERT INTO data_sync_log (
          facility_id, sync_type, table_name, records_synced, 
          sync_status, data_hash, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        facilityId,
        syncType,
        'patients',
        synced,
        syncErrors.length === 0 ? 'completed' : 'completed_with_errors',
        dataHash,
        syncErrors.length > 0 ? JSON.stringify(syncErrors) : null
      ]);

      await client.query('COMMIT');

      return {
        success: true,
        synced,
        errors: syncErrors,
        message: `Successfully synced ${synced} patient records. Errors: ${syncErrors.length}`
      };
    } catch (error) {
      await client.query('ROLLBACK');

      // Log failed sync
      await this.logSyncOperation(facilityId, 'incremental', 'patients', 0, 'error', error.message);

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get sync history for facility
   */
  static async getSyncHistory(facilityId, limit = 50) {
    try {
      const query = `
        SELECT 
          id,
          facility_id,
          sync_type,
          table_name,
          records_synced,
          sync_status,
          started_at,
          completed_at,
          duration_ms,
          created_at
        FROM data_sync_log
        WHERE facility_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await db.query(query, [facilityId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting sync history:', error);
      throw error;
    }
  }

  /**
   * Get latest sync status for facility
   */
  static async getLatestSyncStatus(facilityId) {
    try {
      const query = `
        SELECT 
          id,
          sync_type,
          table_name,
          records_synced,
          sync_status,
          completed_at,
          created_at
        FROM data_sync_log
        WHERE facility_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await db.query(query, [facilityId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting latest sync status:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics by time period
   */
  static async getSyncStatistics(facilityId, days = 30) {
    try {
      const query = `
        SELECT 
          sync_type,
          COUNT(*) as total_syncs,
          SUM(records_synced) as total_records,
          COUNT(CASE WHEN sync_status = 'completed' THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN sync_status IN ('error', 'completed_with_errors') THEN 1 END) as failed_syncs,
          AVG(duration_ms) as avg_duration_ms
        FROM data_sync_log
        WHERE facility_id = $1
          AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY sync_type
      `;

      const result = await db.query(query, [facilityId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting sync statistics:', error);
      throw error;
    }
  }
}

export default DataSyncService;
