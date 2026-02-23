import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/patients
 * List patients with optional filters
 * Query params: facility_id, risk_level, status, search, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const {
      facility_id,
      risk_level,
      status,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    let sql = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    if (facility_id) {
      params.push(facility_id);
      sql += ` AND facility_id = $${params.length}`;
    }

    if (risk_level) {
      params.push(risk_level);
      sql += ` AND risk_level = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (patient_name ILIKE $${params.length} OR phone_number ILIKE $${params.length})`;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM (${sql}) AS filtered`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Paginate
    sql += ' ORDER BY created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch patients' });
  }
});

/**
 * GET /api/patients/stats
 * Get patient statistics (optionally by facility)
 * Query params: facility_id
 */
router.get('/stats', async (req, res) => {
  try {
    const { facility_id } = req.query;

    let whereClause = "WHERE status = 'active'";
    const params = [];

    if (facility_id) {
      params.push(facility_id);
      whereClause += ` AND facility_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE risk_level = 'HIGH') AS high,
        COUNT(*) FILTER (WHERE risk_level = 'MEDIUM') AS medium,
        COUNT(*) FILTER (WHERE risk_level = 'LOW') AS low
      FROM patients ${whereClause}`,
      params
    );

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        total: parseInt(row.total || 0),
        byRiskLevel: {
          HIGH: parseInt(row.high || 0),
          MEDIUM: parseInt(row.medium || 0),
          LOW: parseInt(row.low || 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching patient stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch patient stats' });
  }
});

/**
 * GET /api/patients/facilities
 * List all registered facilities
 */
router.get('/facilities', async (req, res) => {
  try {
    const result = await query(
      `SELECT
        f.facility_id,
        f.facility_name,
        f.location,
        f.status,
        f.last_sync_at,
        f.created_at,
        COUNT(p.id) AS patient_count,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'HIGH') AS high_risk,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'MEDIUM') AS medium_risk,
        COUNT(p.id) FILTER (WHERE p.risk_level = 'LOW') AS low_risk
      FROM facilities f
      LEFT JOIN patients p ON p.facility_id = f.facility_id AND p.status = 'active'
      GROUP BY f.id
      ORDER BY f.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        ...r,
        patient_count: parseInt(r.patient_count || 0),
        high_risk: parseInt(r.high_risk || 0),
        medium_risk: parseInt(r.medium_risk || 0),
        low_risk: parseInt(r.low_risk || 0),
      })),
    });
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch facilities' });
  }
});

export default router;
