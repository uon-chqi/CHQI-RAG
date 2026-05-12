-- ============================================================
-- MIGRATION: KenyaEMR HL7 SIU^S12 appointment payload support
-- Run once on your existing database.
--
-- This keeps compatibility with the existing app code, which already expects:
--   appointments.status, appointments.notes, appointments.metadata
-- while also adding the KenyaEMR/HL7 fields:
--   message_header, patient_identification, appointment_information[]
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. PATIENTS: patient_identification fields
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS gods_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS patient_clinic_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mother_first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mother_middle_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mother_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS village VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ward VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sub_county VARCHAR(100),
  ADD COLUMN IF NOT EXISTS county_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gps_location VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nearest_landmark VARCHAR(255),
  ADD COLUMN IF NOT EXISTS postal_address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS death_date DATE,
  ADD COLUMN IF NOT EXISTS death_indicator VARCHAR(10),
  ADD COLUMN IF NOT EXISTS date_of_birth_precision VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sex VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_patients_gods_number ON patients(gods_number);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_number ON patients(patient_clinic_number);

-- 2. APPOINTMENTS: appointment_information[] plus existing app compatibility
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,

  -- HL7 message_header
  sending_application VARCHAR(100),
  sending_facility VARCHAR(50),
  receiving_application VARCHAR(100),
  receiving_facility VARCHAR(50),
  message_datetime VARCHAR(20),
  security VARCHAR(255),
  message_type VARCHAR(20),
  processing_id VARCHAR(5) DEFAULT 'P',

  -- HL7 appointment_information
  action_code VARCHAR(5),
  appointment_reason VARCHAR(100),
  appointment_placing_entity VARCHAR(100),
  appointment_status VARCHAR(30),
  appointment_type VARCHAR(50),
  appointment_note TEXT,
  appointment_date TIMESTAMPTZ NOT NULL,
  visit_date DATE,
  placer_entity VARCHAR(100),
  placer_number VARCHAR(100),

  -- Existing app columns used by reschedule/SMS/facility sync code
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  raw_payload JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If appointments already existed, add any missing columns safely.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS sending_application VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sending_facility VARCHAR(50),
  ADD COLUMN IF NOT EXISTS receiving_application VARCHAR(100),
  ADD COLUMN IF NOT EXISTS receiving_facility VARCHAR(50),
  ADD COLUMN IF NOT EXISTS message_datetime VARCHAR(20),
  ADD COLUMN IF NOT EXISTS security VARCHAR(255),
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS processing_id VARCHAR(5) DEFAULT 'P',
  ADD COLUMN IF NOT EXISTS action_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS appointment_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS appointment_placing_entity VARCHAR(100),
  ADD COLUMN IF NOT EXISTS appointment_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS appointment_note TEXT,
  ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_date DATE,
  ADD COLUMN IF NOT EXISTS placer_entity VARCHAR(100),
  ADD COLUMN IF NOT EXISTS placer_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE appointments
SET status = COALESCE(status, 'scheduled')
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_facility ON appointments(facility_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_status ON appointments(appointment_status);
CREATE INDEX IF NOT EXISTS idx_appointments_placer_num ON appointments(placer_number);
CREATE INDEX IF NOT EXISTS idx_appointments_visit_date ON appointments(visit_date);

-- Supports existing facility sync ON CONFLICT (patient_id, appointment_date).
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_patient_date_unique
  ON appointments(patient_id, appointment_date);

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. HL7_MESSAGES: raw inbound audit log
CREATE TABLE IF NOT EXISTS hl7_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_type VARCHAR(20),
  sending_application VARCHAR(100),
  sending_facility VARCHAR(50),
  receiving_application VARCHAR(100),
  receiving_facility VARCHAR(50),
  message_datetime VARCHAR(20),
  processing_id VARCHAR(5),
  raw_payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','processed','error')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hl7_messages_type ON hl7_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_hl7_messages_facility ON hl7_messages(sending_facility);
CREATE INDEX IF NOT EXISTS idx_hl7_messages_status ON hl7_messages(status);
CREATE INDEX IF NOT EXISTS idx_hl7_messages_created ON hl7_messages(created_at DESC);
