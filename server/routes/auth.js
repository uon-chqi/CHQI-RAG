// ================================================================
// AUTH ROUTES
// ================================================================
// POST /api/auth/login         - Login (super_admin, county, national)
// GET  /api/auth/me            - Get current user profile
// ================================================================

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'chqi-health-secret-2026';
const TOKEN_EXPIRY = '24h';

// Hard-coded super admin credentials (env-driven)
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'CHQIAdmin@2026';

/**
 * POST /api/auth/login
 * Body: { email, password }  OR  { username, password } for super admin
 */
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    // ── Super Admin login ──────────────────────────────────────
    const loginId = username || email;
    if (
      loginId === SUPER_ADMIN_USERNAME ||
      loginId === process.env.SUPER_ADMIN_EMAIL
    ) {
      if (password !== SUPER_ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { role: 'super_admin', name: 'Super Admin', id: 'super_admin' },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      return res.json({
        success: true,
        data: {
          token,
          user: { id: 'super_admin', name: 'Super Admin', role: 'super_admin', email: loginId },
        },
      });
    }

    // ── Facility / county / national login ─────────────────────
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Ensure auth_users table exists (graceful fallback)
    let result;
    try {
      result = await db.query(
        `SELECT id, email, password_hash, role, facility_id, county_id, name, is_active
         FROM auth_users WHERE email = $1`,
        [email.toLowerCase().trim()]
      );
    } catch (dbErr) {
      console.error('auth_users table error:', dbErr.message);
      return res.status(500).json({ success: false, error: 'Database not ready. Run migrations first.' });
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, error: 'Account is deactivated. Contact administrator.' });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Fetch facility/county info
    let facilityName = null;
    let facilityCode = null;
    let countyName = null;

    if (user.facility_id) {
      try {
        const facResult = await db.query(
          `SELECT f.name, f.code, c.name as county_name
           FROM facilities f
           LEFT JOIN counties c ON f.county_id = c.id
           WHERE f.id = $1`,
          [user.facility_id]
        );
        if (facResult.rows.length > 0) {
          facilityName = facResult.rows[0].name;
          facilityCode = facResult.rows[0].code;
          countyName = facResult.rows[0].county_name;
        }
      } catch (_) {}
    } else if (user.county_id) {
      try {
        const countyResult = await db.query('SELECT name FROM counties WHERE id = $1', [user.county_id]);
        if (countyResult.rows.length > 0) countyName = countyResult.rows[0].name;
      } catch (_) {}
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, facility_id: user.facility_id, county_id: user.county_id },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          facility_id: user.facility_id,
          county_id: user.county_id,
          facility_name: facilityName,
          facility_code: facilityCode,
          county_name: countyName,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'super_admin') {
      return res.json({
        success: true,
        data: { id: 'super_admin', name: 'Super Admin', role: 'super_admin' },
      });
    }

    // Get facility/county info
    let facilityName = null, facilityCode = null, countyName = null;
    if (user.facility_id) {
      try {
        const r = await db.query(
          `SELECT f.name, f.code, c.name as county_name
           FROM facilities f LEFT JOIN counties c ON f.county_id = c.id WHERE f.id = $1`,
          [user.facility_id]
        );
        if (r.rows.length > 0) {
          facilityName = r.rows[0].name;
          facilityCode = r.rows[0].code;
          countyName = r.rows[0].county_name;
        }
      } catch (_) {}
    } else if (user.county_id) {
      try {
        const r = await db.query('SELECT name FROM counties WHERE id = $1', [user.county_id]);
        if (r.rows.length > 0) countyName = r.rows[0].name;
      } catch (_) {}
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        facility_id: user.facility_id,
        county_id: user.county_id,
        facility_name: facilityName,
        facility_code: facilityCode,
        county_name: countyName,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

export default router;
