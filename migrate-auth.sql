-- =============================================================
-- MIGRATION: Add Auth Users, update Facilities, Counties, Patients
-- Run this on your existing database to add authentication support
-- =============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── COUNTIES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'counties_name_unique'
  ) THEN
    ALTER TABLE counties ADD CONSTRAINT counties_name_unique UNIQUE (name);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_counties_name ON counties(name);

-- ── FACILITIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  facility_type VARCHAR(100) DEFAULT 'hospital',
  operational_status VARCHAR(50) DEFAULT 'operational',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add email column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'email'
  ) THEN
    ALTER TABLE facilities ADD COLUMN email VARCHAR(255);
  END IF;
END$$;

-- Add county_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'county_id'
  ) THEN
    ALTER TABLE facilities ADD COLUMN county_id UUID REFERENCES counties(id);
  END IF;
END$$;

-- Add is_active column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE facilities ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END$$;

-- Add operational_status column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'operational_status'
  ) THEN
    ALTER TABLE facilities ADD COLUMN operational_status VARCHAR(50) DEFAULT 'operational';
  END IF;
END$$;

-- Unique constraint on facilities email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facilities_email_unique'
  ) THEN
    ALTER TABLE facilities ADD CONSTRAINT facilities_email_unique UNIQUE (email);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_facilities_county ON facilities(county_id);
CREATE INDEX IF NOT EXISTS idx_facilities_active ON facilities(is_active);

-- ── AUTH USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'facility'
    CHECK (role IN ('super_admin', 'national', 'county', 'facility')),
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_facility ON auth_users(facility_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);

-- ── PATIENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  ccc_number VARCHAR(100),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  gender VARCHAR(20),
  date_of_birth DATE,
  phone VARCHAR(50),
  email VARCHAR(255),
  risk_level VARCHAR(20) DEFAULT 'low',
  next_appointment_date DATE,
  enrollment_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if missing (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'ccc_number') THEN
    ALTER TABLE patients ADD COLUMN ccc_number VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'next_appointment_date') THEN
    ALTER TABLE patients ADD COLUMN next_appointment_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'risk_level') THEN
    ALTER TABLE patients ADD COLUMN risk_level VARCHAR(20) DEFAULT 'low';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_patients_facility ON patients(facility_id);
CREATE INDEX IF NOT EXISTS idx_patients_ccc ON patients(ccc_number);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_appointment ON patients(next_appointment_date);

-- ── DATA SYNC LOG ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  sync_status VARCHAR(50) DEFAULT 'completed',
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sync_facility ON data_sync_log(facility_id);
CREATE INDEX IF NOT EXISTS idx_data_sync_created ON data_sync_log(created_at DESC);

-- ── VERIFICATION ───────────────────────────────────────────────
SELECT 'Migration complete.' AS status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
