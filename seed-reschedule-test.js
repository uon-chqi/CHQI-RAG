import { pool } from './server/config/database.js';

const result = await pool.query(`
  INSERT INTO reschedule_requests 
    (patient_id, facility_id, phone_number, patient_name, original_appointment_date, requested_date, requested_date_raw, reason, status)
  VALUES 
    ('f1a2b3c4-d5e6-f789-0123-456789abcdef', 'd2ebf9de-e73c-4b0e-9189-7654ed1608e2', '+254712345001', 'John Mwangi', '2026-03-18', '2026-04-12', '12 April 2026', 'Too busy at work', 'pending')
  RETURNING id
`);

console.log('Test reschedule request created!');
console.log('ID:', result.rows[0].id);
console.log('\nUse this ID in Postman:');
console.log(`  GET  http://localhost:5000/api/reschedule-requests/${result.rows[0].id}`);
console.log(`  PUT  http://localhost:5000/api/reschedule-requests/${result.rows[0].id}`);
process.exit();
