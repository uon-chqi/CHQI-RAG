// ================================================================
// AUTHORIZATION MIDDLEWARE
// ================================================================
// Express middleware for role-based access control

import AccessControlService from '../services/accessControl.js';

/**
 * Verify user has required permission
 */
const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hasPermission = await AccessControlService.userHasPermission(userId, permissionName);
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

/**
 * Verify user is at least facility admin
 */
const requireFacilityAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hierarchyLevel = await AccessControlService.getUserHierarchyLevel(userId);
    if (hierarchyLevel < 40) { // facility_admin is 40
      return res.status(403).json({ error: 'Facility admin role required' });
    }

    next();
  } catch (error) {
    console.error('Role check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Verify user is at least county admin
 */
const requireCountyAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isCountyAdmin = await AccessControlService.isCountyAdminOrAbove(userId);
    if (!isCountyAdmin) {
      return res.status(403).json({ error: 'County admin role or above required' });
    }

    next();
  } catch (error) {
    console.error('Role check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Verify user is super admin
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isSuperAdmin = await AccessControlService.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin role required' });
    }

    next();
  } catch (error) {
    console.error('Role check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Verify user can access specific facility
 */
const requireFacilityAccess = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const facilityId = req.params.facilityId || req.body.facilityId;

    if (!userId || !facilityId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const hasAccess = await AccessControlService.canAccessFacility(userId, facilityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this facility' });
    }

    // Store in request for use in route handlers
    req.facilityId = facilityId;
    next();
  } catch (error) {
    console.error('Facility access check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Verify user can access specific patient
 */
const requirePatientAccess = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const patientId = req.params.patientId || req.body.patientId;

    if (!userId || !patientId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const hasAccess = await AccessControlService.canAccessPatient(userId, patientId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this patient' });
    }

    // Store in request for use in route handlers
    req.patientId = patientId;
    next();
  } catch (error) {
    console.error('Patient access check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Log data access for audit trail
 */
const auditDataAccess = (operationType, resourceType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const facilityId = req.facilityId || req.body?.facilityId;
      const recordId = req.params.id || req.params.patientId || req.params.facilityId;

      if (userId && facilityId) {
        await AccessControlService.logDataAccess(
          userId,
          facilityId,
          operationType,
          resourceType,
          recordId,
          {
            method: req.method,
            path: req.path,
            timestamp: new Date()
          }
        );
      }

      next();
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't break the request if audit fails
      next();
    }
  };
};

/**
 * Verify user is county admin or above (county, national, super_admin)
 */
const requireCountyAdminOrAbove = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hierarchyLevel = await AccessControlService.getUserHierarchyLevel(userId);
    if (hierarchyLevel < 60) { // county_admin is 60
      return res.status(403).json({ error: 'County admin or above role required' });
    }

    next();
  } catch (error) {
    console.error('Role check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

export {
  requirePermission,
  requireFacilityAdmin,
  requireCountyAdmin,
  requireCountyAdminOrAbove,
  requireSuperAdmin,
  requireFacilityAccess,
  requirePatientAccess,
  auditDataAccess
};
