-- Healthcare RAG System Database Schema
-- PostgreSQL Database Schema for Aiven or any PostgreSQL provider
-- Run this SQL file on your PostgreSQL database to create all required tables

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================
-- COUNTIES TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS counties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT counties_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_counties_name ON counties(name);
CREATE INDEX IF NOT EXISTS idx_counties_active ON counties(is_active);

-- ==============================================
-- FACILITIES TABLE
-- Each registered facility (hospital, clinic, etc.)
-- ==============================================
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT facilities_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_facilities_county ON facilities(county_id);
CREATE INDEX IF NOT EXISTS idx_facilities_active ON facilities(is_active);

-- ==============================================
-- AUTH USERS TABLE
-- Users who can log in: facility staff, county admins, national, super_admin
-- ==============================================
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

-- ==============================================
-- PATIENTS TABLE
-- Patient records for each facility
-- ==============================================
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
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('high', 'medium', 'low', 'HIGH', 'MEDIUM', 'LOW')),
  next_appointment_date DATE,
  enrollment_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_facility ON patients(facility_id);
CREATE INDEX IF NOT EXISTS idx_patients_ccc ON patients(ccc_number);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_risk ON patients(risk_level);
CREATE INDEX IF NOT EXISTS idx_patients_appointment ON patients(next_appointment_date);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(is_active);

-- ==============================================
-- CONVERSATIONS TABLE
-- Stores all patient interactions via SMS/WhatsApp
-- ==============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_phone VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  message TEXT NOT NULL,
  response TEXT,
  citations JSONB DEFAULT '[]'::jsonb,
  response_time_ms INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error')),
  error_message TEXT,
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_patient_phone ON conversations(patient_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);

-- ==============================================
-- DOCUMENTS TABLE
-- Stores uploaded medical documents metadata
-- ==============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  total_chunks INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index for document queries
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);

-- ==============================================
-- SESSIONS TABLE
-- Tracks patient conversation sessions
-- ==============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_phone VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_patient_channel ON sessions(patient_phone, channel);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ==============================================
-- SYSTEM_HEALTH TABLE
-- Monitors health of external services
-- ==============================================
CREATE TABLE IF NOT EXISTS system_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  last_check TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  response_time_ms INTEGER
);

-- Create unique constraint for service_name to enable upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_health_service_name ON system_health(service_name);

-- ==============================================
-- ANALYTICS_DAILY TABLE
-- Stores daily analytics aggregations (optional)
-- ==============================================
CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  total_messages INTEGER DEFAULT 0,
  sms_messages INTEGER DEFAULT 0,
  whatsapp_messages INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  unique_patients INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date DESC);

-- ==============================================
-- FUNCTIONS
-- ==============================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for conversations table
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- SAMPLE DATA (for testing - optional)
-- ==============================================

-- Insert sample system health records
INSERT INTO system_health (service_name, status, last_check)
VALUES
  ('gemini', 'unknown', NOW()),
  ('vector_db', 'unknown', NOW()),
  ('sms', 'unknown', NOW()),
  ('whatsapp', 'unknown', NOW())
ON CONFLICT (service_name) DO NOTHING;

-- ==============================================
-- VERIFICATION QUERIES
-- Run these to verify the schema was created successfully
-- ==============================================

-- List all tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check conversations table structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'conversations';

-- Check if UUID extension is enabled
-- SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';

-- ==============================================
-- NOTES
-- ==============================================

-- 1. DATABASE_URL format for .env file:
--    DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

-- 2. For Aiven, get your connection string from:
--    Aiven Console > Your Service > Overview > Connection Information

-- 3. Ensure SSL is enabled (required by most cloud PostgreSQL providers)

-- 4. Vector embeddings are stored in Pinecone, not in PostgreSQL

-- 5. For production:
--    - Set up regular backups
--    - Configure connection pooling (handled in server/config/database.js)
--    - Monitor query performance
--    - Set up appropriate user permissions

-- 6. To reset the database (WARNING: deletes all data):
--    DROP TABLE IF EXISTS conversations, documents, sessions, system_health, analytics_daily CASCADE;
