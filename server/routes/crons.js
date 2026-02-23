import express from 'express';
import { smsScheduler } from '../services/smsScheduler.js';

const router = express.Router();

// Middleware to verify cron job key (to prevent unauthorized access)
const verifyCronKey = (req, res, next) => {
  const cronKey = req.headers['x-cron-key'];
  const expectedKey = process.env.CRON_KEY || 'your-secret-cron-key';

  if (!cronKey || cronKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing cron key'
    });
  }

  next();
};

/**
 * POST /api/crons/process-appointment-reminders
 * 
 * Process and send automated appointment reminder messages
 * Should be called periodically (e.g., every hour) via a cron job
 * 
 * Headers required:
 *   X-Cron-Key: your-secret-cron-key (set via CRON_KEY environment variable)
 * 
 * Example cron job setup (Linux):
 *   # Every hour
 *   0 * * * * curl -X POST http://localhost:5000/api/crons/process-appointment-reminders \
 *     -H "X-Cron-Key: your-secret-cron-key"
 * 
 * Example for every 30 minutes:
 *   */30 * * * * curl -X POST http://localhost:5000/api/crons/process-appointment-reminders \
 *     -H "X-Cron-Key: your-secret-cron-key"
 */
router.post('/process-appointment-reminders', verifyCronKey, async (req, res) => {
  try {
    console.log('[Cron] Starting appointment reminder processing');
    const result = await smsScheduler.processAppointmentReminders();

    res.json({
      success: true,
      message: 'Appointment reminders processed',
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron] Error processing appointment reminders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process appointment reminders',
      message: error.message
    });
  }
});

/**
 * GET /api/crons/status
 * 
 * Check if the cron service is available
 * No authentication required for health check
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    service: 'SMS Scheduler Cron',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/crons/test-appointment-reminder
 * 
 * Test endpoint that processes a specific appointment
 * For testing purposes only
 */
router.post('/test-appointment-reminder', verifyCronKey, async (req, res) => {
  try {
    const { patientId, appointmentId } = req.body;

    if (!patientId || !appointmentId) {
      return res.status(400).json({
        success: false,
        error: 'patientId and appointmentId are required'
      });
    }

    // Note: For testing, you would fetch the appointment and process it
    // This is a placeholder for testing the SMS scheduler

    res.json({
      success: true,
      message: 'Test appointment reminder processed',
      patientId,
      appointmentId
    });
  } catch (error) {
    console.error('[Cron] Error in test:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message
    });
  }
});

export default router;
