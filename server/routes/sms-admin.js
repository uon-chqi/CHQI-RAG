import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

// Middleware to verify admin access (placeholder - implement based on your auth)
const requireAdmin = (req, res, next) => {
  // TODO: Implement proper admin verification
  // For now, all authenticated requests are allowed
  next();
};

router.use(requireAdmin);

/**
 * GET /api/sms-admin/configurations
 * 
 * Get SMS configurations for a facility
 * Query params: facility_id, risk_level (optional)
 */
router.get('/configurations', async (req, res) => {
  try {
    const { facility_id, risk_level } = req.query;

    if (!facility_id) {
      return res.status(400).json({
        success: false,
        error: 'facility_id is required'
      });
    }

    let sql = 'SELECT * FROM sms_configurations WHERE facility_id = $1';
    const params = [facility_id];

    if (risk_level) {
      sql += ' AND risk_level = $2';
      params.push(risk_level);
    }

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configurations'
    });
  }
});

/**
 * POST /api/sms-admin/configurations
 * 
 * Create or update SMS configuration for a risk level
 * 
 * Request Body:
 * {
 *   "facility_id": "facility-123",
 *   "risk_level": "HIGH",
 *   "message_timing": [
 *     { "days_before_appointment": 30, "time": "09:00", "enabled": true },
 *     { "days_before_appointment": 21, "time": "09:00", "enabled": true },
 *     { "days_before_appointment": 14, "time": "09:00", "enabled": true },
 *     { "days_before_appointment": 7, "time": "09:00", "enabled": true },
 *     { "days_before_appointment": 3, "time": "09:00", "enabled": true },
 *     { "days_before_appointment": 1, "time": "09:00", "enabled": true }
 *   ],
 *   "enabled": true
 * }
 */
router.post('/configurations', async (req, res) => {
  try {
    const { facility_id, risk_level, message_timing, enabled = true } = req.body;

    if (!facility_id || !risk_level || !message_timing) {
      return res.status(400).json({
        success: false,
        error: 'facility_id, risk_level, and message_timing are required'
      });
    }

    if (!['HIGH', 'MEDIUM', 'LOW'].includes(risk_level)) {
      return res.status(400).json({
        success: false,
        error: 'risk_level must be HIGH, MEDIUM, or LOW'
      });
    }

    if (!Array.isArray(message_timing)) {
      return res.status(400).json({
        success: false,
        error: 'message_timing must be an array'
      });
    }

    const result = await query(
      `INSERT INTO sms_configurations 
       (facility_id, risk_level, message_timing, enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (facility_id, risk_level) DO UPDATE
       SET message_timing = $3,
           enabled = $4,
           updated_at = now()
       RETURNING *`,
      [facility_id, risk_level, JSON.stringify(message_timing), enabled]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating/updating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration'
    });
  }
});

/**
 * PUT /api/sms-admin/configurations/:id
 * 
 * Update specific SMS configuration
 */
router.put('/configurations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { message_timing, enabled } = req.body;

    if (!message_timing && enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (message_timing or enabled) must be provided'
      });
    }

    let updateFields = [];
    let params = [];
    let paramIdx = 1;

    if (message_timing !== undefined) {
      updateFields.push(`message_timing = $${paramIdx}`);
      params.push(JSON.stringify(message_timing));
      paramIdx++;
    }

    if (enabled !== undefined) {
      updateFields.push(`enabled = $${paramIdx}`);
      params.push(enabled);
      paramIdx++;
    }

    updateFields.push(`updated_at = now()`);
    params.push(id);

    const sql = `UPDATE sms_configurations 
                 SET ${updateFields.join(', ')}
                 WHERE id = $${paramIdx}
                 RETURNING *`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

/**
 * GET /api/sms-admin/budget-limits
 * 
 * Get SMS budget limits for a facility
 */
router.get('/budget-limits', async (req, res) => {
  try {
    const { facility_id, risk_level } = req.query;

    if (!facility_id) {
      return res.status(400).json({
        success: false,
        error: 'facility_id is required'
      });
    }

    let sql = 'SELECT * FROM sms_budget_limits WHERE facility_id = $1';
    const params = [facility_id];

    if (risk_level) {
      sql += ' AND risk_level = $2';
      params.push(risk_level);
    }

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching budget limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget limits'
    });
  }
});

/**
 * POST /api/sms-admin/budget-limits
 * 
 * Create or update SMS budget limits
 * 
 * Request Body:
 * {
 *   "facility_id": "facility-123",
 *   "risk_level": "HIGH",
 *   "messages_per_month": 1000,
 *   "messages_per_patient_per_month": 50,
 *   "enabled": true
 * }
 */
router.post('/budget-limits', async (req, res) => {
  try {
    const { 
      facility_id, 
      risk_level, 
      messages_per_month,
      messages_per_patient_per_month,
      budget_month_start_day = 1,
      enabled = true 
    } = req.body;

    if (!facility_id || !risk_level || messages_per_month === undefined) {
      return res.status(400).json({
        success: false,
        error: 'facility_id, risk_level, and messages_per_month are required'
      });
    }

    if (!['HIGH', 'MEDIUM', 'LOW'].includes(risk_level)) {
      return res.status(400).json({
        success: false,
        error: 'risk_level must be HIGH, MEDIUM, or LOW'
      });
    }

    const result = await query(
      `INSERT INTO sms_budget_limits 
       (facility_id, risk_level, messages_per_month, messages_per_patient_per_month, 
        budget_month_start_day, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (facility_id, risk_level) DO UPDATE
       SET messages_per_month = $3,
           messages_per_patient_per_month = $4,
           budget_month_start_day = $5,
           enabled = $6,
           updated_at = now()
       RETURNING *`,
      [facility_id, risk_level, messages_per_month, messages_per_patient_per_month, 
       budget_month_start_day, enabled]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating/updating budget limit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save budget limit'
    });
  }
});

/**
 * GET /api/sms-admin/message-templates
 * 
 * Get message templates for a facility
 */
router.get('/message-templates', async (req, res) => {
  try {
    const { facility_id, template_type, risk_level } = req.query;

    if (!facility_id) {
      return res.status(400).json({
        success: false,
        error: 'facility_id is required'
      });
    }

    let sql = 'SELECT * FROM message_templates WHERE facility_id = $1';
    const params = [facility_id];

    if (template_type) {
      sql += ` AND template_type = $${params.length + 1}`;
      params.push(template_type);
    }

    if (risk_level) {
      sql += ` AND (risk_level = $${params.length + 1} OR risk_level IS NULL)`;
      params.push(risk_level);
    }

    const result = await query(sql + ' ORDER BY template_type', params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching message templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message templates'
    });
  }
});

/**
 * POST /api/sms-admin/message-templates
 * 
 * Create message template
 * 
 * Request Body:
 * {
 *   "facility_id": "facility-123",
 *   "template_type": "appointment_reminder",
 *   "risk_level": "HIGH",
 *   "body": "Hi {{patient_name}}, your appointment is on {{appointment_date}}",
 *   "variables": ["patient_name", "appointment_date"],
 *   "enabled": true
 * }
 */
router.post('/message-templates', async (req, res) => {
  try {
    const { facility_id, template_type, risk_level, subject, body, variables = [], enabled = true } = req.body;

    if (!facility_id || !template_type || !body) {
      return res.status(400).json({
        success: false,
        error: 'facility_id, template_type, and body are required'
      });
    }

    const result = await query(
      `INSERT INTO message_templates 
       (facility_id, template_type, risk_level, subject, body, variables, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [facility_id, template_type, risk_level || null, subject, body, JSON.stringify(variables), enabled]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating message template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save message template'
    });
  }
});

/**
 * PUT /api/sms-admin/message-templates/:id
 * 
 * Update message template
 */
router.put('/message-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, variables, enabled } = req.body;

    let updateFields = [];
    let params = [];
    let paramIdx = 1;

    if (subject !== undefined) {
      updateFields.push(`subject = $${paramIdx}`);
      params.push(subject);
      paramIdx++;
    }

    if (body !== undefined) {
      updateFields.push(`body = $${paramIdx}`);
      params.push(body);
      paramIdx++;
    }

    if (variables !== undefined) {
      updateFields.push(`variables = $${paramIdx}`);
      params.push(JSON.stringify(variables));
      paramIdx++;
    }

    if (enabled !== undefined) {
      updateFields.push(`enabled = $${paramIdx}`);
      params.push(enabled);
      paramIdx++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be provided'
      });
    }

    updateFields.push(`updated_at = now()`);
    params.push(id);

    const sql = `UPDATE message_templates 
                 SET ${updateFields.join(', ')}
                 WHERE id = $${paramIdx}
                 RETURNING *`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message template not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating message template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update message template'
    });
  }
});

export default router;
