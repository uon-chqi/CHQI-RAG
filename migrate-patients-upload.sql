-- ============================================================
-- MIGRATION: Add CSV upload fields to patients table
-- ============================================================
-- Adds columns needed for bulk CSV patient data uploads
-- Run this on your PostgreSQL database before deploying the upload feature

-- 1. Add new columns to patients table (one ALTER per column for safety)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS external_patient_id INTEGER;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_visit_date DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS risk_score DECIMAL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS risk_factors TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_viral_load VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS appointment_status VARCHAR(50) DEFAULT 'Pending';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS county VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sub_county VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ward VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS city_village VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS landmark VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address5 VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address6 VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS case_manager VARCHAR(255);

-- 2. Change next_appointment_date from DATE to TIMESTAMPTZ to capture time
ALTER TABLE patients
  ALTER COLUMN next_appointment_date TYPE TIMESTAMPTZ USING next_appointment_date::TIMESTAMPTZ;

-- 3. Update risk_level CHECK constraint to allow 'unknown'
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_risk_level_check;
ALTER TABLE patients ADD CONSTRAINT patients_risk_level_check
  CHECK (risk_level IN ('high', 'medium', 'low', 'unknown', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'));

-- 4. Add indexes for new filterable columns
CREATE INDEX IF NOT EXISTS idx_patients_county ON patients(county);
CREATE INDEX IF NOT EXISTS idx_patients_sub_county ON patients(sub_county);
CREATE INDEX IF NOT EXISTS idx_patients_appointment_status ON patients(appointment_status);
CREATE INDEX IF NOT EXISTS idx_patients_external_id ON patients(external_patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_last_visit ON patients(last_visit_date);

-- 5. Verify
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patients' ORDER BY ordinal_position;
