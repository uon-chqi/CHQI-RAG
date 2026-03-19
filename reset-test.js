import { pool } from './server/config/database.js';

// Reset the test record back to pending
await pool.query(`
  UPDATE reschedule_requests 
  SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, sms_notification_sent = false, updated_at = NOW()
  WHERE id = '5cd5fd81-8a79-4a1b-9277-d8392b9a3c41'
`);

// Delete any duplicate appointments created from previous test
await pool.query(`
  DELETE FROM appointments 
  WHERE patient_id = 'f1a2b3c4-d5e6-f789-0123-456789abcdef' 
  AND notes = 'Rescheduled via SMS'
`);

console.log('Test record reset to pending. Ready for re-test.');
process.exit();
