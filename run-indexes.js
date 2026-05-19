import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    // First ensure the missing column exists
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS external_patient_id INTEGER');
    console.log('Ensured external_patient_id column exists');

    const stmts = [
      'CREATE INDEX IF NOT EXISTS idx_patients_county ON patients(county)',
      'CREATE INDEX IF NOT EXISTS idx_patients_sub_county ON patients(sub_county)',
      'CREATE INDEX IF NOT EXISTS idx_patients_appointment_status ON patients(appointment_status)',
      'CREATE INDEX IF NOT EXISTS idx_patients_external_id ON patients(external_patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_patients_last_visit ON patients(last_visit_date)',
      'CREATE INDEX IF NOT EXISTS idx_patients_active_created_at ON patients(created_at DESC) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_patients_active_facility_created_at ON patients(facility_id, created_at DESC) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_patients_active_facility_risk ON patients(facility_id, risk_level) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_patients_active_facility_phone ON patients(facility_id, phone) WHERE is_active = TRUE AND phone IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_patients_active_risk ON patients(risk_level) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_patients_active_next_appointment ON patients(next_appointment_date) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_conversations_created_at_desc ON conversations(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_patient_phone_created_at ON conversations(patient_phone, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_facilities_active_county ON facilities(county_id) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_counties_active_name ON counties(name) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_auth_users_active ON auth_users(id) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)',
      'CREATE INDEX IF NOT EXISTS idx_flagged_patients_facility_status ON flagged_patients(facility_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_flagged_patients_facility_created_at ON flagged_patients(facility_id, created_at DESC)',
    ];
    for (const s of stmts) {
      console.log('Running:', s.substring(0, 70) + '...');
      await client.query(s);
      console.log('  OK');
    }

    const res = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patients' ORDER BY ordinal_position`
    );
    console.log('\nPatients table columns:');
    res.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    console.log(`\nTotal: ${res.rows.length} columns`);
    console.log('Migration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

run();
