import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, phone, channel, startDate, endDate } = req.query;

    let sql = 'SELECT * FROM conversations WHERE 1=1';
    const params = [];

    if (phone) {
      params.push(`%${phone}%`);
      sql += ` AND patient_phone ILIKE $${params.length}`;
    }

    if (channel) {
      params.push(channel);
      sql += ` AND channel = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      sql += ` AND created_at <= $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) as filtered`, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    const offset = (page - 1) * limit;
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
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM conversations WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.get('/phone/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    const result = await query(
      'SELECT * FROM conversations WHERE patient_phone = $1 ORDER BY created_at ASC',
      [phoneNumber]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

export default router;
