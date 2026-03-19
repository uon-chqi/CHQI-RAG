import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flagged_patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id),
      facility_id UUID REFERENCES facilities(id),
      conversation_id UUID,
      flagged_message TEXT NOT NULL,
      flagged_words TEXT[] NOT NULL DEFAULT '{}',
      severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_flagged_patients_patient ON flagged_patients(patient_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_flagged_patients_facility ON flagged_patients(facility_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_flagged_patients_status ON flagged_patients(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_flagged_patients_severity ON flagged_patients(severity)`);

  console.log('✅ flagged_patients table created successfully');
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await pool.end();
}
