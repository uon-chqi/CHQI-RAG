// ================================================================
// USER MANAGEMENT SERVICE
// ================================================================
// Handles user creation, authentication, and role assignment

import bcrypt from 'bcrypt';
import db from '../config/database.js';
import AccessControlService from './accessControl.js';

class UserManagementService {
  /**
   * Create a new user
   */
  static async createUser(userData, createdByUserId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const {
        email,
        phone,
        firstName,
        lastName,
        password,
        facilityId,
        countyId,
        nationalId,
        gender,
        dateOfBirth,
        jobTitle
      } = userData;

      // Validate email uniqueness
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (emailCheck.rows.length > 0) {
        throw new Error('Email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const userQuery = `
        INSERT INTO users (
          email, phone, first_name, last_name, password_hash,
          facility_id, county_id, national_id, gender, date_of_birth, job_title
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const result = await client.query(userQuery, [
        email,
        phone,
        firstName,
        lastName,
        passwordHash,
        facilityId || null,
        countyId || null,
        nationalId || null,
        gender || null,
        dateOfBirth || null,
        jobTitle || null
      ]);

      const user = result.rows[0];

      // Log audit
      await client.query(`
        INSERT INTO facility_data_audit (facility_id, user_id, operation_type, table_name, record_id, new_values)
        VALUES ($1, $2, 'create', 'users', $3, $4)
      `, [
        facilityId || null,
        createdByUserId,
        user.id,
        JSON.stringify(user)
      ]);

      await client.query('COMMIT');
      return { ...user, password_hash: undefined };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Assign role to user
   */
  static async assignRoleToUser(userId, roleId, facilityId, countyId, assignedByUserId) {
    try {
      const query = `
        INSERT INTO user_roles (user_id, role_id, facility_id, county_id, assigned_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const result = await db.query(query, [userId, roleId, facilityId || null, countyId || null, assignedByUserId]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('User already has this role');
      }
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  static async removeRoleFromUser(userRoleId) {
    try {
      const query = 'DELETE FROM user_roles WHERE id = $1 RETURNING *';
      const result = await db.query(query, [userRoleId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await db.query(query, [email]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user by ID with their roles
   */
  static async getUser(userId) {
    try {
      const query = `
        SELECT 
          u.id,
          u.email,
          u.phone,
          u.first_name,
          u.last_name,
          u.facility_id,
          u.county_id,
          u.is_active,
          u.last_login,
          u.created_at,
          u.updated_at,
          (SELECT json_agg(row_to_json(ur.*))
           FROM user_roles ur
           INNER JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = u.id) as roles
        FROM users u
        WHERE u.id = $1
      `;

      const result = await db.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Authenticate user (login)
   */
  static async authenticateUser(email, password) {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.is_active) {
        throw new Error('User account is inactive');
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        throw new Error('Invalid password');
      }

      // Update last login
      await db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      return { ...user, password_hash: undefined };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user password
   */
  static async updateUserPassword(userId, oldPassword, newPassword) {
    try {
      const user = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      const passwordMatch = await bcrypt.compare(oldPassword, user.rows[0].password_hash);
      if (!passwordMatch) {
        throw new Error('Current password is incorrect');
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE users SET password_hash = $1, last_password_change = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * List users in facility (with access control)
   */
  static async listFacilityUsers(facilityId, requestingUserId) {
    try {
      // Check access
      const hasAccess = await AccessControlService.canAccessFacility(requestingUserId, facilityId);
      if (!hasAccess) {
        throw new Error('You do not have access to this facility');
      }

      const query = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.job_title,
          u.is_active,
          u.last_login,
          (SELECT json_agg(row_to_json(r.*))
           FROM user_roles ur
           INNER JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = u.id AND ur.is_active) as roles
        FROM users u
        WHERE u.facility_id = $1
        ORDER BY u.created_at DESC
      `;

      const result = await db.query(query, [facilityId]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(userId) {
    try {
      const query = `
        UPDATE users
        SET is_active = FALSE, account_status = 'inactive'
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Activate user
   */
  static async activateUser(userId) {
    try {
      const query = `
        UPDATE users
        SET is_active = TRUE, account_status = 'active'
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if user exists and is active
   */
  static async userExists(userId) {
    try {
      const query = 'SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE';
      const result = await db.query(query, [userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
}

export default UserManagementService;
