import express from 'express';
import db from '../config/database.js';

const router = express.Router();

/**
 * GET /api/flagged/stats
 * Returns total flagged counts, optionally filtered by facility_id
 */
router.get('/stats', async (req, res) => {
  try {
    const { facility_id } = req.query;
    let sql = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE severity = 'high')::int AS high
      FROM flagged_patients
    `;
    const params = [];
    if (facility_id) {
      params.push(facility_id);
      sql += ` WHERE facility_id = $1`;
    }
    const result = await db.query(sql, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Flagged stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flagged stats' });
  }
});

/**
 * GET /api/flagged
 * List flagged patients with patient + facility details.
 * Query: ?facility_id=UUID&status=pending&severity=critical
 */
router.get('/', async (req, res) => {
  try {
    const { facility_id, status, severity } = req.query;
    let sql = `
      SELECT fp.*,
        p.first_name, p.last_name, p.phone, p.ccc_number, p.risk_level,
        f.name AS facility_name, f.code AS facility_code,
        c.name AS county_name
      FROM flagged_patients fp
      LEFT JOIN patients p ON fp.patient_id = p.id
      LEFT JOIN facilities f ON fp.facility_id = f.id
      LEFT JOIN counties c ON f.county_id = c.id
    `;
    const conditions = [];
    const params = [];

    if (facility_id) {
      params.push(facility_id);
      conditions.push(`fp.facility_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`fp.status = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      conditions.push(`fp.severity = $${params.length}`);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY fp.created_at DESC';

    const result = await db.query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Flagged list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flagged patients' });
  }
});

/**
 * GET /api/flagged/:id
 * Get single flagged record with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT fp.*,
        p.first_name, p.last_name, p.phone, p.ccc_number, p.risk_level,
        p.date_of_birth, p.email, p.gender,
        f.name AS facility_name, f.code AS facility_code,
        c.name AS county_name
      FROM flagged_patients fp
      LEFT JOIN patients p ON fp.patient_id = p.id
      LEFT JOIN facilities f ON fp.facility_id = f.id
      LEFT JOIN counties c ON f.county_id = c.id
      WHERE fp.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Flagged detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch record' });
  }
});

/**
 * PUT /api/flagged/:id
 * Update status (mark as reviewed / resolved)
 * Body: { status: 'reviewed' | 'resolved', notes?: string }
 */
router.put('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status || !['reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be "reviewed" or "resolved"' });
    }

    const result = await db.query(`
      UPDATE flagged_patients
      SET status = $1, notes = COALESCE($2, notes), reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, notes || null, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Flagged update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update record' });
  }
});

export default router;
