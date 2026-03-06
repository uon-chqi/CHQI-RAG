// ================================================================
// ACCESS CONTROL SERVICE
// ================================================================
// Middleware and utility functions for role-based access control

import db from '../config/database.js';

class AccessControlService {
  /**
   * Check if user has a specific permission
   */
  static async userHasPermission(userId, permissionName) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1
          FROM user_roles ur
          INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
          INNER JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = $1
            AND p.name = $2
            AND ur.is_active = TRUE
        ) AS has_permission
      `;
      
      const result = await db.query(query, [userId, permissionName]);
      return result.rows[0].has_permission;
    } catch (error) {
      console.error('Error checking user permission:', error);
      throw error;
    }
  }

  /**
   * Get user's role hierarchy level
   */
  static async getUserHierarchyLevel(userId) {
    try {
      const query = `
        SELECT MAX(r.hierarchy_level) as max_level
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND ur.is_active = TRUE
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows[0]?.max_level || 0;
    } catch (error) {
      console.error('Error getting user hierarchy level:', error);
      throw error;
    }
  }

  /**
   * Get all roles assigned to user with their scopes
   */
  static async getUserRoles(userId) {
    try {
      const query = `
        SELECT 
          ur.id as assignment_id,
          r.id as role_id,
          r.name,
          r.display_name,
          r.scope,
          r.hierarchy_level,
          ur.facility_id,
          ur.county_id,
          ur.is_active
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
        ORDER BY r.hierarchy_level DESC
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user roles:', error);
      throw error;
    }
  }

  /**
   * Get facilities accessible by user based on role
   */
  static async getUserAccessibleFacilities(userId) {
    try {
      const query = `
        SELECT DISTINCT
          f.id,
          f.name,
          f.code,
          f.county_id,
          c.name as county_name,
          f.facility_type,
          f.is_active
        FROM get_user_accessible_facilities($1) AS f
        LEFT JOIN counties c ON f.county_id = c.id
        ORDER BY f.name
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting accessible facilities:', error);
      throw error;
    }
  }

  /**
   * Check if user can access specific facility
   */
  static async canAccessFacility(userId, facilityId) {
    try {
      const accessibleFacilities = await this.getUserAccessibleFacilities(userId);
      return accessibleFacilities.some(f => f.id === facilityId);
    } catch (error) {
      console.error('Error checking facility access:', error);
      throw error;
    }
  }

  /**
   * Check if user can access specific patient
   */
  static async canAccessPatient(userId, patientId) {
    try {
      const query = `
        SELECT 1
        FROM patients p
        WHERE p.id = $1
          AND p.facility_id IN (
            SELECT DISTINCT f.facility_id FROM get_user_accessible_facilities($2) AS f
          )
      `;
      
      const result = await db.query(query, [patientId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking patient access:', error);
      throw error;
    }
  }

  /**
   * Get user's counties accessibility (for County Admin)
   */
  static async getUserAccessibleCounties(userId) {
    try {
      const query = `
        SELECT DISTINCT
          c.id,
          c.name,
          c.code,
          c.region,
          c.is_active
        FROM user_roles ur
        INNER JOIN counties c ON ur.county_id = c.id
        WHERE ur.user_id = $1 AND ur.is_active = TRUE
        ORDER BY c.name
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting accessible counties:', error);
      throw error;
    }
  }

  /**
   * Build SQL WHERE clause for user's data access
   * Returns WHERE clause that filters by accessible facilities
   */
  static async buildAccessFilterSQL(userId, tableAlias = '') {
    try {
      const prefix = tableAlias ? `${tableAlias}.` : '';
      const accessibleFacilities = await this.getUserAccessibleFacilities(userId);
      
      if (accessibleFacilities.length === 0) {
        throw new Error('User has no accessible facilities');
      }

      const facilityIds = accessibleFacilities.map(f => `'${f.id}'`).join(',');
      return `${prefix}facility_id IN (${facilityIds})`;
    } catch (error) {
      console.error('Error building access filter SQL:', error);
      throw error;
    }
  }

  /**
   * Log data access for audit trail
   */
  static async logDataAccess(userId, facilityId, operationType, tableName, recordId, details = {}) {
    try {
      const query = `
        INSERT INTO facility_data_audit (
          facility_id,
          user_id,
          operation_type,
          table_name,
          record_id,
          new_values,
          user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      await db.query(query, [
        facilityId,
        userId,
        operationType,
        tableName,
        recordId,
        JSON.stringify(details),
        null
      ]);
    } catch (error) {
      console.error('Error logging data access:', error);
      // Don't throw - audit logging shouldn't break main operation
    }
  }

  /**
   * Verify user is super admin
   */
  static async isSuperAdmin(userId) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM user_roles ur
          INNER JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1 AND r.name = 'super_admin' AND ur.is_active = TRUE
        ) AS is_super_admin
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows[0].is_super_admin;
    } catch (error) {
      console.error('Error checking super admin:', error);
      throw error;
    }
  }

  /**
   * Verify user is at least county admin
   */
  static async isCountyAdminOrAbove(userId) {
    try {
      const hierarchyLevel = await this.getUserHierarchyLevel(userId);
      return hierarchyLevel >= 60; // county_admin is level 60
    } catch (error) {
      console.error('Error checking county admin level:', error);
      throw error;
    }
  }
}

export default AccessControlService;
