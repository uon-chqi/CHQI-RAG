// ================================================================
// USERS & ROLES API ROUTES
// ================================================================
// API endpoints for user management and role assignment with RBAC

import express from 'express';
import UserManagementService from '../services/userManagement.js';
import AccessControlService from '../services/accessControl.js';
import db from '../config/database.js';
import {
  requirePermission,
  requireFacilityAdmin,
  requireCountyAdmin,
  requireSuperAdmin,
  requireFacilityAccess,
  auditDataAccess
} from '../middleware/authorization.js';

const router = express.Router();

/**
 * GET /api/users/profile
 * Get current user profile
 */
router.get('/profile', async (req, res) => {
  try {
    const user = await UserManagementService.getUser(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add permissions
    const roles = await AccessControlService.getUserRoles(req.user.id);
    const facilities = await AccessControlService.getUserAccessibleFacilities(req.user.id);
    
    res.json({
      success: true,
      data: {
        ...user,
        roles,
        accessible_facilities: facilities
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/me/permissions
 * Get all permissions for current user
 */
router.get('/me/permissions', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT p.name, p.description, p.resource, p.action
      FROM user_roles ur
      INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1 AND ur.is_active = TRUE
      ORDER BY p.resource, p.action
    `;

    const result = await db.query(query, [req.user.id]);
    res.json({
      success: true,
      permissions: result.rows
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/users
 * Create new user (requires facility admin or above)
 */
router.post(
  '/',
  requireFacilityAdmin,
  auditDataAccess('create', 'users'),
  async (req, res) => {
    try {
      const user = await UserManagementService.createUser(req.body, req.user.id);
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/users/:userId
 * Update user information
 */
router.put('/:userId', requireFacilityAdmin, async (req, res) => {
  try {
    const { firstName, lastName, jobTitle, phone } = req.body;

    const query = `
      UPDATE users
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          job_title = COALESCE($3, job_title),
          phone = COALESCE($4, phone),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

    const result = await db.query(query, [firstName, lastName, jobTitle, phone, req.params.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:facilityId/list
 * List all users in a facility
 */
router.get(
  '/facility/:facilityId/list',
  requireFacilityAccess,
  async (req, res) => {
    try {
      const users = await UserManagementService.listFacilityUsers(
        req.facilityId,
        req.user.id
      );
      res.json({
        success: true,
        count: users.length,
        data: users
      });
    } catch (error) {
      console.error('Error listing facility users:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/users/:userId/password
 * Change user password
 */
router.post('/:userId/password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    // Users can only change their own password unless they're admin
    const isAdmin = await AccessControlService.isSuperAdmin(req.user.id);
    if (req.params.userId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'You can only change your own password' });
    }

    await UserManagementService.updateUserPassword(
      req.params.userId,
      oldPassword,
      newPassword
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/users/:userId/roles
 * Assign role to user
 */
router.post(
  '/:userId/roles',
  requireCountyAdmin,
  auditDataAccess('create', 'user_roles'),
  async (req, res) => {
    try {
      const { roleId, facilityId, countyId } = req.body;
      
      const userRole = await UserManagementService.assignRoleToUser(
        req.params.userId,
        roleId,
        facilityId || null,
        countyId || null,
        req.user.id
      );

      res.status(201).json({
        success: true,
        data: userRole
      });
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/users/:userId/roles/:roleId
 * Remove role from user
 */
router.delete(
  '/:userId/roles/:roleId',
  requireCountyAdmin,
  auditDataAccess('delete', 'user_roles'),
  async (req, res) => {
    try {
      const result = await db.query(
        'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 RETURNING *',
        [req.params.userId, req.params.roleId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User role not found' });
      }

      res.json({
        success: true,
        message: 'Role removed from user'
      });
    } catch (error) {
      console.error('Error removing role:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/users/:userId/deactivate
 * Deactivate user account
 */
router.post(
  '/:userId/deactivate',
  requireCountyAdmin,
  async (req, res) => {
    try {
      const user = await UserManagementService.deactivateUser(req.params.userId);
      res.json({
        success: true,
        message: 'User deactivated',
        data: user
      });
    } catch (error) {
      console.error('Error deactivating user:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/users/:userId/activate
 * Activate user account
 */
router.post(
  '/:userId/activate',
  requireCountyAdmin,
  async (req, res) => {
    try {
      const user = await UserManagementService.activateUser(req.params.userId);
      res.json({
        success: true,
        message: 'User activated',
        data: user
      });
    } catch (error) {
      console.error('Error activating user:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/roles
 * List all available roles
 */
router.get('/roles', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, display_name, hierarchy_level, scope, description FROM roles WHERE is_active = TRUE ORDER BY hierarchy_level DESC'
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
