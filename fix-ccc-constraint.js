import dotenv from 'dotenv'; dotenv.config();
import pkg from 'pg'; const { Pool } = pkg;

const pool = new Pool({
  database: process.env.DB_NAME, host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
});

async function run() {
  // Add unique constraint on ccc_number for upsert support
  try {
    await pool.query(`ALTER TABLE patients ADD CONSTRAINT patients_ccc_number_unique UNIQUE (ccc_number)`);
    console.log('✅ Added UNIQUE on patients.ccc_number');
  } catch (e) {
    if (e.message.includes('already exists')) console.log('✅ patients.ccc_number UNIQUE already exists');
    else console.error('❌', e.message);
  }

  // Add data_sync_log.sync_status column if missing (referenced in admin dashboard query)
  try {
    await pool.query(`ALTER TABLE data_sync_log ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'pending'`);
    console.log('✅ data_sync_log.sync_status column ensured');
  } catch (e) {
    console.log('data_sync_log fix:', e.message);
  }

  // Update existing data_sync_log.sync_status from .status if needed
  try {
    await pool.query(`UPDATE data_sync_log SET sync_status = status WHERE sync_status IS NULL OR sync_status = 'pending'`);
    console.log('✅ Synced status values');
  } catch (e) { /* ignore */ }

  await pool.end();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
