import { pool } from './server/config/database.js';

try {
  const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sms_sent_messages' ORDER BY ordinal_position`);
  console.log('sms_sent_messages columns:');
  r.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
} catch(e) {
  console.log('ERROR:', e.message);
}

try {
  const r2 = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'appointments' ORDER BY ordinal_position`);
  console.log('\nappointments columns:');
  r2.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
} catch(e) {
  console.log('ERROR:', e.message);
}

process.exit();
