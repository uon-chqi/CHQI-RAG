// ================================================================
// JWT AUTHENTICATION MIDDLEWARE
// ================================================================
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'chqi-health-secret-2026';

/**
 * Verify JWT token and attach user to request.
 * Roles: super_admin | national | county | facility
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // For super_admin, no DB lookup needed – credentials are static
    if (decoded.role === 'super_admin') {
      req.user = { id: 'super_admin', role: 'super_admin', name: decoded.name || 'Super Admin' };
      return next();
    }

    // For facility users, validate against DB
    const result = await db.query(
      `SELECT id, email, role, facility_id, county_id, name, is_active
       FROM auth_users WHERE id = $1 AND is_active = TRUE`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

/**
 * Require super_admin role
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: 'Super admin access required' });
  }
  next();
};

/**
 * Require county or above
 */
export const requireCountyOrAbove = (req, res, next) => {
  const allowed = ['super_admin', 'national', 'county'];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'County admin access required' });
  }
  next();
};

/**
 * Optional auth – attach user if token present, but don't block
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'super_admin') {
      req.user = { id: 'super_admin', role: 'super_admin', name: decoded.name || 'Super Admin' };
      return next();
    }

    const result = await db.query(
      `SELECT id, email, role, facility_id, county_id, name, is_active
       FROM auth_users WHERE id = $1 AND is_active = TRUE`,
      [decoded.id]
    );
    if (result.rows.length > 0) req.user = result.rows[0];
  } catch (_) {
    // silently skip
  }
  next();
};

export default { authenticateToken, requireSuperAdmin, requireCountyOrAbove, optionalAuth };
