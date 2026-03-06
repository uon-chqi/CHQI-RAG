// ================================================================
// FACILITY MANAGEMENT SERVICE
// ================================================================
// Manages facility operations and multi-facility data access

import db from '../config/database.js';
import AccessControlService from './accessControl.js';

class FacilityService {
  /**
   * Create a new facility
   */
  static async createFacility(facilityData, createdByUserId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const {
        name,
        code,
        countyId,
        facilityType,
        phone,
        email,
        physicalAddress,
        latitude,
        longitude
      } = facilityData;

      // Check facility code uniqueness
      const codeCheck = await client.query(
        'SELECT id FROM facilities WHERE code = $1',
        [code]
      );
      if (codeCheck.rows.length > 0) {
        throw new Error('Facility code already exists');
      }

      // Create facility
      const facilityQuery = `
        INSERT INTO facilities (
          name, code, county_id, facility_type, phone, email, 
          physical_address, latitude, longitude
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await client.query(facilityQuery, [
        name,
        code,
        countyId,
        facilityType,
        phone || null,
        email || null,
        physicalAddress || null,
        latitude || null,
        longitude || null
      ]);

      const facility = result.rows[0];

      // Log audit
      await client.query(`
        INSERT INTO facility_data_audit (facility_id, user_id, operation_type, table_name, record_id, new_values)
        VALUES ($1, $2, 'create', 'facilities', $3, $4)
      `, [
        facility.id,
        createdByUserId,
        facility.id,
        JSON.stringify(facility)
      ]);

      await client.query('COMMIT');
      return facility;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get facility details
   */
  static async getFacility(facilityId, requestingUserId) {
    try {
      // Check access
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const query = `
        SELECT 
          f.id,
          f.name,
          f.code,
          f.county_id,
          c.name as county_name,
          f.facility_type,
          f.phone,
          f.email,
          f.website,
          f.physical_address,
          f.latitude,
          f.longitude,
          f.is_active,
          f.operational_status,
          f.created_at,
          f.updated_at
        FROM facilities f
        LEFT JOIN counties c ON f.county_id = c.id
        WHERE f.id = $1
      `;

      const result = await db.query(query, [facilityId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get facilities accessible to user
   */
  static async getFacilitiesForUser(requestingUserId, filters = {}) {
    try {
      let query = `
        SELECT 
          f.id,
          f.name,
          f.code,
          f.county_id,
          c.name as county_name,
          f.facility_type,
          f.is_active,
          f.operational_status,
          f.created_at,
          (SELECT COUNT(*) FROM patients WHERE facility_id = f.id) as patient_count,
          (SELECT COUNT(*) FROM users WHERE facility_id = f.id AND is_active = TRUE) as active_users
        FROM get_user_accessible_facilities($1) AS f
        LEFT JOIN counties c ON f.county_id = c.id
        WHERE 1=1
      `;

      const params = [requestingUserId];
      let paramIndex = 2;

      if (filters.isActive !== undefined) {
        query += ` AND f.is_active = $${paramIndex}`;
        params.push(filters.isActive);
        paramIndex++;
      }

      if (filters.countyId) {
        query += ` AND f.county_id = $${paramIndex}`;
        params.push(filters.countyId);
        paramIndex++;
      }

      if (filters.facilityType) {
        query += ` AND f.facility_type = $${paramIndex}`;
        params.push(filters.facilityType);
        paramIndex++;
      }

      query += ' ORDER BY f.name';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update facility information
   */
  static async updateFacility(facilityId, facilityData, requestingUserId) {
    try {
      // Check access
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const {
        name,
        phone,
        email,
        website,
        physicalAddress,
        operationalStatus
      } = facilityData;

      const query = `
        UPDATE facilities
        SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          website = COALESCE($4, website),
          physical_address = COALESCE($5, physical_address),
          operational_status = COALESCE($6, operational_status),
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;

      const result = await db.query(query, [
        name || null,
        phone || null,
        email || null,
        website || null,
        physicalAddress || null,
        operationalStatus || null,
        facilityId
      ]);

      const facility = result.rows[0];

      // Log audit
      await AccessControlService.logDataAccess(
        requestingUserId,
        facilityId,
        'update',
        'facilities',
        facilityId,
        facilityData
      );

      return facility;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get facility statistics
   */
  static async getFacilityStats(facilityId, requestingUserId) {
    try {
      // Check access
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const query = `
        SELECT
          (SELECT COUNT(*) FROM patients WHERE facility_id = $1) as total_patients,
          (SELECT COUNT(*) FROM patients WHERE facility_id = $1 AND patient_status = 'active') as active_patients,
          (SELECT COUNT(*) FROM patient_ccc_numbers WHERE facility_id = $1 AND enrollment_status = 'active') as active_ccc_enrollments,
          (SELECT COUNT(*) FROM users WHERE facility_id = $1 AND is_active = TRUE) as active_staff,
          (SELECT COUNT(*) FROM conversations WHERE created_at >= NOW() - INTERVAL '30 days' 
           AND patient_phone IN (
             SELECT p.phone FROM patients p WHERE p.facility_id = $1
           )) as messages_last_30_days
      `;

      const result = await db.query(query, [facilityId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate facility
   */
  static async deactivateFacility(facilityId, requestingUserId) {
    try {
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const query = `
        UPDATE facilities
        SET is_active = FALSE, operational_status = 'inactive'
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, [facilityId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate API key for facility (for data push)
   */
  static async generateFacilityAPIKey(facilityId, requestingUserId) {
    try {
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const crypto = require('crypto');
      const apiKey = crypto.randomBytes(32).toString('hex');
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      const query = `
        UPDATE facilities
        SET api_key_hash = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      await db.query(query, [apiKeyHash, facilityId]);

      // Return plain api key (shown only once)
      return {
        facilityId,
        apiKey,
        createdAt: new Date(),
        note: 'Save this API key securely. You will not be able to see it again.'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify facility API key
   */
  static async verifyFacilityAPIKey(facilityId, apiKey) {
    try {
      const crypto = require('crypto');
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      const query = `
        SELECT id FROM facilities
        WHERE id = $1 AND api_key_hash = $2 AND is_active = TRUE
      `;

      const result = await db.query(query, [facilityId, apiKeyHash]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

export default FacilityService;
