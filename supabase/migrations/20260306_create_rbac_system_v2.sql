-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. COUNTIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS counties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  region VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counties_name ON counties(name);
CREATE INDEX IF NOT EXISTS idx_counties_code ON counties(code);

-- ============================================================
-- 2. FACILITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  county_id UUID NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
  registration_number VARCHAR(100),
  facility_type VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  physical_address TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  is_active BOOLEAN DEFAULT TRUE,
  operational_status VARCHAR(50) DEFAULT 'active',
  database_credentials JSONB,
  api_key_hash VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_county_id ON facilities(county_id);
CREATE INDEX IF NOT EXISTS idx_facilities_code ON facilities(code);
CREATE INDEX IF NOT EXISTS idx_facilities_name ON facilities(name);

-- ============================================================
-- 3. ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  hierarchy_level INTEGER NOT NULL,
  scope VARCHAR(50) NOT NULL,
  is_system_role BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy_level ON roles(hierarchy_level DESC);

-- Insert System Roles
INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('super_admin', 'Super Administrator', 'Full access to all facilities nationwide', 100, 'global', TRUE);

INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('national_admin', 'National Administrator', 'Access to all facilities at national level', 80, 'national', TRUE);

INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('county_admin', 'County Administrator', 'Access to all facilities in county', 60, 'county', TRUE);

INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('facility_admin', 'Facility Administrator', 'Full access to single facility', 40, 'facility', TRUE);

INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('facility_manager', 'Facility Manager', 'Manage facility operations', 30, 'facility', TRUE);

INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('data_analyst', 'Data Analyst', 'View reports and analytics', 25, 'facility', TRUE);

INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('facility_staff', 'Facility Staff', 'Data entry and basic operations', 20, 'facility', TRUE);

INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role) VALUES
('guest', 'Guest', 'Read-only access', 10, 'facility', TRUE);

-- ============================================================
-- 4. PERMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- Insert Standard Permissions
INSERT INTO permissions (resource, action, description) VALUES
('facilities', 'create', 'Create new facilities'),
('facilities', 'read', 'View facility information'),
('facilities', 'update', 'Update facility details'),
('facilities', 'delete', 'Delete facilities'),
('patients', 'create', 'Create patient records'),
('patients', 'read', 'View patient records'),
('patients', 'update', 'Update patient records'),
('patients', 'delete', 'Delete patient records'),
('users', 'create', 'Create user accounts'),
('users', 'read', 'View user information'),
('users', 'update', 'Update user details'),
('users', 'delete', 'Delete user accounts'),
('reports', 'create', 'Generate reports'),
('reports', 'read', 'View reports'),
('audit', 'read', 'View audit logs'),
('sync', 'execute', 'Execute data sync'),
('sync', 'read', 'View sync history'),
('roles', 'manage', 'Manage roles and permissions');

-- ============================================================
-- 5. ROLE PERMISSIONS JUNCTION TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Assign permissions to super_admin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin';

-- ============================================================
-- 6. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  job_title VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- 7. USER ROLES JUNCTION TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id, facility_id, county_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ============================================================
-- 8. PATIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  physical_address TEXT,
  ccc_number VARCHAR(50),
  risk_level VARCHAR(20) DEFAULT 'low',
  enrollment_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_facility_id ON patients(facility_id);
CREATE INDEX IF NOT EXISTS idx_patients_ccc_number ON patients(ccc_number);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);

-- ============================================================
-- 9. PATIENT CCC NUMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_ccc_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  ccc_number VARCHAR(50) NOT NULL,
  enrollment_date DATE NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ccc_number, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_ccc_numbers_patient_id ON patient_ccc_numbers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_ccc_numbers_ccc ON patient_ccc_numbers(ccc_number);

-- ============================================================
-- 10. FACILITY DATA AUDIT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS facility_data_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_facility_id ON facility_data_audit(facility_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON facility_data_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON facility_data_audit(created_at DESC);

-- ============================================================
-- 11. DATA SYNC LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS data_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) DEFAULT 'incremental',
  status VARCHAR(50) DEFAULT 'pending',
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  data_hash VARCHAR(255),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_facility_id ON data_sync_log(facility_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON data_sync_log(status);

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
-- All tables created successfully!
