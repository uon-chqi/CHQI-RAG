-- =======================================================================================
-- HEALTHCARE RAG SYSTEM - ROLE-BASED ACCESS CONTROL (RBAC) SCHEMA
-- =======================================================================================
-- This migration creates a multi-level hierarchical access control system:
-- SUPER_ADMIN > NATIONAL_ADMIN > COUNTY_ADMIN > FACILITY_ADMIN/STAFF
--
-- Each facility has its own instance with isolated data
-- Counties can view only their facilities
-- National admin can view all facilities
-- Super admin has complete access
-- =======================================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================================================
-- 1. COUNTIES TABLE
-- =======================================================================================
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
CREATE INDEX IF NOT EXISTS idx_counties_is_active ON counties(is_active);

-- =======================================================================================
-- 2. FACILITIES TABLE
-- =======================================================================================
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  county_id UUID NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
  registration_number VARCHAR(100),
  facility_type VARCHAR(50) NOT NULL CHECK (facility_type IN ('hospital', 'clinic', 'dispensary', 'health_center', 'maternity', 'other')),
  
  -- Contact Information
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  
  -- Location
  physical_address TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  
  -- Operational Status
  is_active BOOLEAN DEFAULT TRUE,
  operational_status VARCHAR(50) DEFAULT 'active' CHECK (operational_status IN ('active', 'inactive', 'suspended', 'under_maintenance')),
  
  -- Database Credentials (optional - for direct data push)
  database_credentials JSONB,
  api_key_hash VARCHAR(255),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_county_id ON facilities(county_id);
CREATE INDEX IF NOT EXISTS idx_facilities_code ON facilities(code);
CREATE INDEX IF NOT EXISTS idx_facilities_is_active ON facilities(is_active);
CREATE INDEX IF NOT EXISTS idx_facilities_name ON facilities(name);

-- =======================================================================================
-- 3. ROLES TABLE
-- =======================================================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Hierarchical level (higher number = more privileges)
  hierarchy_level INTEGER NOT NULL,
  
  -- Scope of access
  scope VARCHAR(50) NOT NULL CHECK (scope IN ('global', 'national', 'county', 'facility')),
  
  -- Standard roles flag
  is_system_role BOOLEAN DEFAULT FALSE,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy_level ON roles(hierarchy_level DESC);
CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles(scope);

-- Insert System Roles
INSERT INTO roles (name, display_name, description, hierarchy_level, scope, is_system_role)
VALUES
  ('super_admin', 'Super Administrator', 'Full access to all facilities and system functions nationwide', 100, 'global', TRUE),
  ('national_admin', 'National Administrator', 'Access to all facilities at national level', 80, 'national', TRUE),
  ('county_admin', 'County Administrator', 'Access to all facilities within their county', 60, 'county', TRUE),
  ('facility_admin', 'Facility Administrator', 'Full access to their facility data', 40, 'facility', TRUE),
  ('facility_manager', 'Facility Manager', 'Management access to their facility', 30, 'facility', TRUE),
  ('facility_staff', 'Facility Staff', 'Limited access to their facility data', 20, 'facility', TRUE),
  ('data_analyst', 'Data Analyst', 'Read-only access for analysis', 25, 'facility', TRUE),
  ('guest', 'Guest User', 'Limited read-only access', 10, 'facility', TRUE)
ON CONFLICT (name) DO NOTHING;

-- =======================================================================================
-- 4. PERMISSIONS TABLE
-- =======================================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert standard permissions
INSERT INTO permissions (name, resource, action, description)
VALUES
  -- Facility Permissions
  ('facility:view', 'facility', 'view', 'View facility information'),
  ('facility:create', 'facility', 'create', 'Create a new facility'),
  ('facility:edit', 'facility', 'edit', 'Edit facility information'),
  ('facility:delete', 'facility', 'delete', 'Delete a facility'),
  
  -- User Management
  ('user:view', 'user', 'view', 'View users'),
  ('user:create', 'user', 'create', 'Create users'),
  ('user:edit', 'user', 'edit', 'Edit users'),
  ('user:delete', 'user', 'delete', 'Delete users'),
  ('user:manage_roles', 'user', 'manage_roles', 'Manage user roles'),
  
  -- Patient Permissions
  ('patient:view', 'patient', 'view', 'View patient data'),
  ('patient:create', 'patient', 'create', 'Create patient records'),
  ('patient:edit', 'patient', 'edit', 'Edit patient records'),
  ('patient:delete', 'patient', 'delete', 'Delete patient records'),
  
  -- Data Export
  ('data:export', 'data', 'export', 'Export facility data'),
  ('data:audit', 'data', 'audit', 'View audit logs'),
  
  -- System Admin
  ('system:manage', 'system', 'manage', 'Manage system settings'),
  ('system:view_logs', 'system', 'view_logs', 'View system logs')
ON CONFLICT (name) DO NOTHING;

-- =======================================================================================
-- 5. ROLE PERMISSIONS JUNCTION TABLE
-- =======================================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Assign permissions to system roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'super_admin' AND p.name IN (
  'facility:view', 'facility:create', 'facility:edit', 'facility:delete',
  'user:view', 'user:create', 'user:edit', 'user:delete', 'user:manage_roles',
  'patient:view', 'patient:create', 'patient:edit', 'patient:delete',
  'data:export', 'data:audit', 'system:manage', 'system:view_logs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'national_admin' AND p.name IN (
  'facility:view', 'facility:create', 'facility:edit',
  'user:view', 'user:create', 'user:edit', 'user:manage_roles',
  'patient:view', 'patient:create', 'patient:edit',
  'data:export', 'data:audit'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'county_admin' AND p.name IN (
  'facility:view', 'user:view', 'user:create', 'user:edit',
  'patient:view', 'patient:create', 'patient:edit',
  'data:export', 'data:audit'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'facility_admin' AND p.name IN (
  'facility:view', 'user:view', 'user:create', 'user:edit', 'user:manage_roles',
  'patient:view', 'patient:create', 'patient:edit', 'patient:delete',
  'data:export', 'data:audit'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'facility_manager' AND p.name IN (
  'facility:view', 'user:view',
  'patient:view', 'patient:create', 'patient:edit',
  'data:export'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'facility_staff' AND p.name IN (
  'patient:view', 'patient:create', 'patient:edit'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =======================================================================================
-- 6. USERS TABLE
-- =======================================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Facility Assignment (NULL for super/national admin)
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  
  -- County Assignment (NULL for super admin or if assigned to facility)
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  
  -- Personal Details
  date_of_birth DATE,
  gender VARCHAR(20),
  national_id VARCHAR(50) UNIQUE,
  
  -- Professional Details
  professional_license VARCHAR(100),
  specialization VARCHAR(255),
  job_title VARCHAR(100),
  
  -- Account Status
  is_active BOOLEAN DEFAULT TRUE,
  account_status VARCHAR(50) DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  
  -- Two-Factor Authentication
  is_2fa_enabled BOOLEAN DEFAULT FALSE,
  two_fa_secret VARCHAR(255),
  
  -- Password Management
  password_change_required BOOLEAN DEFAULT FALSE,
  last_password_change TIMESTAMPTZ,
  
  -- Last Activity
  last_login TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_facility_id ON users(facility_id);
CREATE INDEX IF NOT EXISTS idx_users_county_id ON users(county_id);
CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- =======================================================================================
-- 7. USER ROLES JUNCTION TABLE
-- =======================================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  
  -- Scope specification (for multi-scope roles)
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  UNIQUE(user_id, role_id, facility_id, county_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_facility_id ON user_roles(facility_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_county_id ON user_roles(county_id);

-- =======================================================================================
-- 8. PATIENTS TABLE
-- =======================================================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  
  -- Basic Information
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  
  -- Contact Information
  phone VARCHAR(50),
  email VARCHAR(255),
  
  -- Identification
  national_id VARCHAR(50),
  passport_number VARCHAR(50),
  
  -- Medical Information
  blood_group VARCHAR(10),
  chronic_conditions JSONB DEFAULT '[]'::jsonb,
  allergies JSONB DEFAULT '[]'::jsonb,
  current_medications JSONB DEFAULT '[]'::jsonb,
  
  -- Emergency Contact
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  emergency_contact_relationship VARCHAR(50),
  
  -- Address
  residential_address TEXT,
  city VARCHAR(255),
  county VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  patient_status VARCHAR(50) DEFAULT 'active' CHECK (patient_status IN ('active', 'inactive', 'transferred', 'deceased')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_facility_id ON patients(facility_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

-- =======================================================================================
-- 9. PATIENT CCC NUMBERS TABLE
-- =======================================================================================
-- CCC (Comprehensive Care Clinic) numbers are unique patient identifiers in Kenya
CREATE TABLE IF NOT EXISTS patient_ccc_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  
  ccc_number VARCHAR(50) NOT NULL UNIQUE,
  -- CCC number format typically: DDMMYY + 00001 (facility code + sequence)
  
  enrollment_date DATE NOT NULL,
  enrollment_status VARCHAR(50) DEFAULT 'active' CHECK (enrollment_status IN ('active', 'inactive', 'transferred', 'lost_to_followup')),
  
  is_primary BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_ccc_ccc_number ON patient_ccc_numbers(ccc_number);
CREATE INDEX IF NOT EXISTS idx_patient_ccc_patient_id ON patient_ccc_numbers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_ccc_facility_id ON patient_ccc_numbers(facility_id);

-- =======================================================================================
-- 10. FACILITY DATA AUDIT TABLE
-- =======================================================================================
-- Tracks all data operations at facility level for compliance
CREATE TABLE IF NOT EXISTS facility_data_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Operation Details
  operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('create', 'read', 'update', 'delete', 'export')),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  
  -- Before/After Values
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  
  -- Metadata
  ip_address VARCHAR(50),
  user_agent TEXT,
  request_id UUID,
  
  -- Compliance
  is_compliant BOOLEAN DEFAULT TRUE,
  compliance_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_audit_facility_id ON facility_data_audit(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_audit_user_id ON facility_data_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_facility_audit_table_name ON facility_data_audit(table_name);
CREATE INDEX IF NOT EXISTS idx_facility_audit_created_at ON facility_data_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facility_audit_operation_type ON facility_data_audit(operation_type);

-- =======================================================================================
-- 11. DATA SYNC LOG TABLE
-- =======================================================================================
-- Tracks data synchronization from facility databases to central database
CREATE TABLE IF NOT EXISTS data_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  
  -- Sync Details
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'realtime')),
  table_name VARCHAR(100) NOT NULL,
  records_synced INTEGER DEFAULT 0,
  
  -- Status
  sync_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'error')),
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Data Hash for integrity verification
  data_hash VARCHAR(255),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_facility_id ON data_sync_log(facility_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_sync_status ON data_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON data_sync_log(created_at DESC);

-- =======================================================================================
-- 12. ACCESS CONTROL FUNCTIONS
-- =======================================================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_permission_name VARCHAR(100)
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
      AND p.name = p_permission_name
      AND ur.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's accessible facilities
CREATE OR REPLACE FUNCTION get_user_accessible_facilities(p_user_id UUID)
RETURNS TABLE(facility_id UUID, facility_name VARCHAR, county_id UUID) AS $$
BEGIN
  -- Super Admin sees all facilities
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = 'super_admin' AND ur.is_active
  ) THEN
    RETURN QUERY SELECT f.id, f.name, f.county_id FROM facilities f;
    RETURN;
  END IF;
  
  -- National Admin sees all facilities
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = 'national_admin' AND ur.is_active
  ) THEN
    RETURN QUERY SELECT f.id, f.name, f.county_id FROM facilities f;
    RETURN;
  END IF;
  
  -- County Admin sees facilities in their county
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = 'county_admin' AND ur.is_active
  ) THEN
    RETURN QUERY
    SELECT f.id, f.name, f.county_id
    FROM facilities f
    WHERE f.county_id IN (
      SELECT ur.county_id FROM user_roles ur WHERE ur.user_id = p_user_id AND ur.is_active
    );
    RETURN;
  END IF;
  
  -- Facility-level users see only their facility
  RETURN QUERY
  SELECT f.id, f.name, f.county_id
  FROM facilities f
  WHERE f.id IN (
    SELECT ur.facility_id FROM user_roles ur WHERE ur.user_id = p_user_id AND ur.is_active AND ur.facility_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get patients for facility (with access control)
CREATE OR REPLACE FUNCTION get_facility_patients(
  p_user_id UUID,
  p_facility_id UUID
) RETURNS TABLE(patient_id UUID, first_name VARCHAR, last_name VARCHAR, phone VARCHAR, ccc_number VARCHAR) AS $$
BEGIN
  -- Check if user has access to this facility
  IF NOT EXISTS (
    SELECT 1 FROM get_user_accessible_facilities(p_user_id) AS f WHERE f.facility_id = p_facility_id
  ) THEN
    RAISE EXCEPTION 'User does not have access to this facility';
  END IF;
  
  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, p.phone, pcn.ccc_number
  FROM patients p
  LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id AND pcn.is_primary = TRUE
  WHERE p.facility_id = p_facility_id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =======================================================================================
-- 13. TRIGGERS
-- =======================================================================================

-- Trigger to update users table timestamps
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update patients table timestamps
DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update facilities table timestamps
DROP TRIGGER IF EXISTS update_facilities_updated_at ON facilities;
CREATE TRIGGER update_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to audit patient_ccc_numbers changes
DROP TRIGGER IF EXISTS audit_patient_ccc_changes ON patient_ccc_numbers;
CREATE TRIGGER audit_patient_ccc_changes
    BEFORE UPDATE ON patient_ccc_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =======================================================================================
-- 14. SAMPLE DATA (OPTIONAL - for testing)
-- =======================================================================================

-- Insert sample counties
INSERT INTO counties (name, code, region) VALUES
  ('Nairobi', 'NRB', 'Central'),
  ('Kiambu', 'KBU', 'Central'),
  ('Nakuru', 'NKU', 'Rift Valley'),
  ('Kisumu', 'KSM', 'Western'),
  ('Mombasa', 'MBA', 'Coastal'),
  ('Makueni', 'MKN', 'Eastern')
ON CONFLICT (code) DO NOTHING;

-- Insert sample facilities
INSERT INTO facilities (name, code, county_id, facility_type, phone, operational_status) VALUES
  ('Kenyatta National Hospital', 'FCD001', (SELECT id FROM counties WHERE code = 'NRB'), 'hospital', '0711222333', 'active'),
  ('Nairobi County Health Centre', 'FCD002', (SELECT id FROM counties WHERE code = 'NRB'), 'clinic', '0722444555', 'active'),
  ('Kiambu Teaching Hospital', 'FCD003', (SELECT id FROM counties WHERE code = 'KBU'), 'hospital', '0733666777', 'active')
ON CONFLICT (code) DO NOTHING;

-- =======================================================================================
-- NOTES AND DOCUMENTATION
-- =======================================================================================
/*
HIERARCHICAL ACCESS CONTROL MODEL:

1. SUPER_ADMIN (hierarchy_level: 100)
   - Access: All facilities nationwide
   - Scope: Global
   - Can: Manage everything, view all data, manage all users

2. NATIONAL_ADMIN (hierarchy_level: 80)
   - Access: All facilities nationwide
   - Scope: National
   - Can: Manage all facilities, view all patient data, manage users at any facility

3. COUNTY_ADMIN (hierarchy_level: 60)
   - Access: Only facilities in their assigned county
   - Scope: County
   - Can: Manage facilities in their county, view patient data from their facilities

4. FACILITY_ADMIN (hierarchy_level: 40)
   - Access: Only their assigned facility
   - Scope: Facility
   - Can: Manage their facility, manage staff, view all patient data

5. FACILITY_MANAGER (hierarchy_level: 30)
   - Access: Only their assigned facility
   - Scope: Facility
   - Can: Manage operations, create/edit patient records, view reports

6. FACILITY_STAFF (hierarchy_level: 20)
   - Access: Only their assigned facility (limited)
   - Scope: Facility
   - Can: Create/view patient records

7. DATA_ANALYST (hierarchy_level: 25)
   - Access: Assigned scope (facility/county/national)
   - Scope: Flexible
   - Can: Read-only access for analysis and reporting

8. GUEST (hierarchy_level: 10)
   - Access: Limited facility access
   - Scope: Facility
   - Can: View limited patient information

DATA FLOW ARCHITECTURE:

Facility Level:
├── Facility pushes data to API endpoint OR
├── Facility directly syncs to PostgreSQL OR
└── Real-time data ingestion

Central Database:
├── All facility data consolidated
├── Separated by facility_id
└── County/National admin can query across facilities

Queries by Access Level:
├── SUPER_ADMIN: SELECT * FROM patients (all facilities)
├── NATIONAL_ADMIN: SELECT * FROM patients (all facilities)
├── COUNTY_ADMIN: SELECT * FROM patients WHERE facility_id IN (county facilities)
└── FACILITY_STAFF: SELECT * FROM patients WHERE facility_id = current_facility

COMPLIANCE & AUDIT:

- All operations logged in facility_data_audit
- Data sync tracked in data_sync_log
- Timestamps for all operations
- User tracking (who did what, when, from where)

IMPLEMENTATION NOTES:

1. Use the get_user_accessible_facilities() function in API queries
2. Always filter results by user's accessible facilities
3. Log all operations in facility_data_audit
4. Implement rate limiting for API endpoints
5. Use transactions for data consistency
6. Validate facility_id ownership before operations
*/
