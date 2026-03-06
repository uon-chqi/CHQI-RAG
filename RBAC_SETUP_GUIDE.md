# Role-Based Access Control (RBAC) System Setup Guide

## Overview

This healthcare RAG system implements a hierarchical, multi-facility RBAC system with 4 organizational levels and 8 user roles. Each facility manages its own patient data, while super admin can access all data centrally.

## Architecture

### Organizational Hierarchy

```
┌─────────────────────────────────────────────────────┐
│        SUPER ADMIN (Global Access)                   │
│  - Access to ALL facilities nationwide               │
│  - Can manage all users and roles                    │
│  - Centralized data dashboard                       │
└─────────────┬───────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────┐
│     NATIONAL ADMIN (National Level)                  │
│  - Access to all facilities nationwide               │
│  - Can create/manage facilities and users           │
└─────────────┬───────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────┐
│   COUNTY ADMIN (County Level)                        │
│  - Access to facilities ONLY in their county         │
│  - Can manage users in their county                 │
│  - View aggregated county data                      │
└─────────────┬───────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────┐
│ FACILITY-LEVEL (Facility Level)                      │
│  - FACILITY_ADMIN: Full facility management         │
│  - FACILITY_MANAGER: Operational management         │
│  - FACILITY_STAFF: Data entry/view                  │
│  - DATA_ANALYST: Read-only analysis access         │
│  - GUEST: Limited read-only access                 │
└─────────────────────────────────────────────────────┘
```

## Database Tables Created

### 1. **counties**
- Stores county information
- Used for geographic data organization
- Filter access for county admins

### 2. **facilities**
- Healthcare facilities (hospitals, clinics, dispensaries)
- Each facility has a `county_id`
- API key for data push authentication
- Database credentials (optional for direct sync)

### 3. **users**
- User accounts with authentication
- Assigned to specific facility or county
- Two-factor authentication support
- Password management

### 4. **roles**
- 8 system roles with hierarchy levels
- Scope: global, national, county, facility
- Role-based permission assignments

### 5. **permissions**
- Granular action permissions (view, create, edit, delete)
- Resources: facility, user, patient, data, system

### 6. **user_roles** (Junction Table)
- Maps users to roles
- Supports role-specific scopes (facility/county)
- Track role assignments and changes

### 7. **patients**
- Patient records with medical information
- Facility-specific isolation
- Health data: blood group, conditions, allergies, medications
- Emergency contact information

### 8. **patient_ccc_numbers**
- CCC (Comprehensive Care Clinic) numbers - unique patient IDs in Kenya
- Multiple CCC numbers per patient
- Primary CCC tracking
- Enrollment and followup status

### 9. **facility_data_audit**
- Audit trail for all data operations
- Track: who, what, when, from where
- Compliance documentation
- Before/after values for changes

### 10. **data_sync_log**
- Tracks facility-to-central database synchronization
- Sync status and timing
- Data integrity verification (hash)
- Error logging

## SQL Migration

Run this migration to create all tables and functions:

```bash
psql -U username -d database_name -f supabase/migrations/20260306_create_rbac_system.sql
```

## Backend Services

### AccessControlService (`services/accessControl.js`)
Handles permission checking and access control logic
- `userHasPermission()` - Check if user has permission
- `getUserAccessibleFacilities()` - Get facilities user can access
- `canAccessFacility()` - Verify facility access
- `canAccessPatient()` - Verify patient access
- `buildAccessFilterSQL()` - Generate SQL filters for access control

### UserManagementService (`services/userManagement.js`)
User lifecycle management
- `createUser()` - Create new user account
- `assignRoleToUser()` - Assign role with scope
- `authenticateUser()` - Login with password verification
- `updateUserPassword()` - Change password
- `listFacilityUsers()` - Get users in facility

### FacilityService (`services/facilityManagement.js`)
Facility management with API keys
- `createFacility()` - Register new facility
- `getFacility()` - Get facility details
- `getFacilitiesForUser()` - List user's accessible facilities
- `generateFacilityAPIKey()` - Generate API key for data push
- `verifyFacilityAPIKey()` - Validate facility API key

### PatientDataService (`services/patientData.js`)
Patient record management with multi-facility support
- `createPatient()` - Create patient record
- `getPatient()` - Get patient details
- `listFacilityPatients()` - List facility patients
- `updatePatient()` - Update patient information
- `addCCCNumber()` - Register CCC number
- `getPatientByCCC()` - Find patient by CCC number
- `getPatientsForReport()` - Generate reports by date range

### DataSyncService (`services/dataSync.js`)
Facility data synchronization
- `syncPatientData()` - Sync patient data from facility
- `getSyncHistory()` - Get sync operation history
- `getLatestSyncStatus()` - Get latest sync result
- `getSyncStatistics()` - Sync statistics and trends

## Authorization Middleware (`middleware/authorization.js`)

Express middleware for protecting routes:

```javascript
// Require permission
router.post('/action', requirePermission('user:create'), handler);

// Require role
router.post('/manage', requireFacilityAdmin, handler);

// Check facility access
router.get('/facility/:id', requireFacilityAccess, handler);

// Check patient access
router.get('/patient/:id', requirePatientAccess, handler);

// Audit logging
router.post('/save', auditDataAccess('create', 'patients'), handler);
```

## API Routes

### Facilities Routes (`routes/facilities.js`)

```
GET    /api/facilities                      - List accessible facilities
GET    /api/facilities/:facilityId          - Get facility details
POST   /api/facilities                      - Create facility (super admin)
PUT    /api/facilities/:facilityId          - Update facility
GET    /api/facilities/:facilityId/stats    - Get facility statistics
POST   /api/facilities/:facilityId/api-key  - Generate API key
DELETE /api/facilities/:facilityId          - Deactivate facility
```

### Users Routes (`routes/users.js`)

```
GET    /api/users/profile                   - Get current user profile
GET    /api/users/me/permissions            - Get user permissions
POST   /api/users                           - Create user (facility admin+)
PUT    /api/users/:userId                   - Update user information
GET    /api/users/facility/:id/list         - List facility users
POST   /api/users/:userId/password          - Change password
POST   /api/users/:userId/roles             - Assign role
DELETE /api/users/:userId/roles/:roleId     - Remove role
GET    /api/roles                           - List all roles
```

### Patients Routes (`routes/patients.js`)

```
GET    /api/patients                        - List accessible patients
GET    /api/patients/facility/:id/list      - List facility patients
GET    /api/patients/:patientId             - Get patient details
POST   /api/patients/facility/:id/create    - Create patient
PUT    /api/patients/:patientId             - Update patient
POST   /api/patients/:patientId/ccc         - Add CCC number
GET    /api/patients/search/ccc/:ccc        - Find patient by CCC
GET    /api/patients/facility/:id/report    - Generate date-range report
```

### Data Sync Routes (`routes/sync.js`)

```
POST   /api/sync/data                       - Sync data from facility (with API key)
GET    /api/sync/history/:facilityId        - Get sync history
GET    /api/sync/status/:facilityId         - Get latest sync status
GET    /api/sync/stats/:facilityId          - Get sync statistics
```

### Admin Routes (`routes/admin.js`)

```
GET    /api/admin/dashboard                 - Super admin dashboard
GET    /api/admin/county/:id/dashboard      - County admin dashboard
GET    /api/admin/facilities-data           - Centralized patient data export
GET    /api/admin/audit-log                 - Centralized audit log
GET    /api/admin/sync-status               - All facilities sync status
```

## Data Flow

### Facility Data Push

```
Facility Database
       ↓
  [Cron Job]
       ↓
POST /api/sync/data (with X-Facility-API-Key header)
       ↓
   DataSyncService.syncPatientData()
       ↓
Central PostgreSQL Database
       ↓
Super Admin Dashboard (Query all facilities)
```

### Data Access Flow

```
User makes request
     ↓
Authentication Middleware (verify JWT/session)
     ↓
Authorization Middleware (check permission/role)
     ↓
AccessControl.getUserAccessibleFacilities()
     ↓
Filter SQL Results by accessible facilities
     ↓
auditDataAccess() - Log operation
     ↓
Return filtered data
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install bcrypt jsonwebtoken dotenv pg
```

### 2. Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/healthcare_rag
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production
```

### 3. Create Super Admin User

```javascript
// server/scripts/create-superadmin.js
const UserManagementService = require('../services/userManagement');

async function createSuperAdmin() {
  const superAdmin = await UserManagementService.createUser({
    email: 'admin@healthcare.com',
    firstName: 'Super',
    lastName: 'Admin',
    password: 'temporary_password_123',
    dateOfBirth: null,
    gender: 'other'
  }, null); // null for system creation

  // Assign super admin role
  const db = require('../config/database');
  const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', ['super_admin']);
  
  await db.query(
    'INSERT INTO user_roles (user_id, role_id, is_active) VALUES ($1, $2, TRUE)',
    [superAdmin.id, roleResult.rows[0].id]
  );

  console.log('Super admin created:', superAdmin.email);
}

createSuperAdmin().catch(console.error);
```

### 4. Register First Facility

Super admin logs in and registers first facility:

```bash
POST /api/facilities
Body: {
  "name": "Kenyatta National Hospital",
  "code": "KNH001",
  "countyId": "county_uuid",
  "facilityType": "hospital",
  "phone": "0711222333",
  "email": "info@knh.org"
}
```

### 5. Create Facility Admin User

```bash
POST /api/users
Body: {
  "email": "admin@knh.org",
  "firstName": "John",
  "lastName": "Doe",
  "password": "secure_password",
  "facilityId": "facility_uuid",
  "jobTitle": "Hospital Administrator"
}

# Then assign role
POST /api/users/:userId/roles
Body: {
  "roleId": "facility_admin_role_uuid",
  "facilityId": "facility_uuid"
}
```

### 6. Generate API Key for Facility

Facility admin generates API key for data push:

```bash
POST /api/facilities/:facilityId/api-key
Response: {
  "facilityId": "...",
  "apiKey": "long_random_api_key_shown_once",
  "createdAt": "...",
  "note": "Save this securely"
}
```

### 7. Facility Data Sync Setup

Facility cron job pushes data daily:

```javascript
// facility/cron/sync-to-central.js
const axios = require('axios');

async function syncToCentralDatabase() {
  const patientData = await facility_db.query('SELECT * FROM patients LIMIT 1000');
  
  const response = await axios.post('https://central-server/api/sync/data', {
    syncType: 'incremental', // or 'full'
    patients: patientData.rows
  }, {
    headers: {
      'X-Facility-ID': process.env.FACILITY_ID,
      'X-Facility-API-Key': process.env.FACILITY_API_KEY
    }
  });
  
  console.log('Sync result:', response.data);
}
```

## Database Queries by Role

### Super Admin - Access All Patients

```sql
SELECT * FROM patients
UNION
SELECT * FROM facility_data_audit;
```

### National Admin - Same as Super Admin

```sql
SELECT * FROM patients;
```

### County Admin - Only County Facilities

```sql
SELECT p.* FROM patients p
INNER JOIN facilities f ON p.facility_id = f.id
INNER JOIN counties c ON f.county_id = c.id
WHERE c.id = $1; -- their county
```

### Facility Staff - Only Their Facility

```sql
SELECT p.* FROM patients p
WHERE p.facility_id = $1; -- their facility
```

##Access Control Query Function

```sql
SELECT * FROM get_user_accessible_facilities(user_uuid);
SELECT * FROM get_facility_patients(user_uuid, facility_uuid);
```

## Compliance & Audit

### Audit Trail
All operations logged in `facility_data_audit`:
- User who performed action
- Timestamp
- Type of operation (create, read, update, delete)
- Old vs new values
- IP address and user agent

### Data Integrity
- Hash verification for sync operations
- Before/after snapshots for changes
- Role-based encryption (optional)

### Compliance Reports

```sql
-- Get all changes to patient data in date range
SELECT * FROM facility_data_audit
WHERE table_name = 'patients'
  AND created_at BETWEEN start_date AND end_date
  AND facility_id = facility_uuid
ORDER BY created_at DESC;

-- Audit user access
SELECT * FROM facility_data_audit
WHERE user_id = user_uuid
ORDER BY created_at DESC;
```

## Troubleshooting

### User Cannot Access Facility

1. Check user_roles has assignment
2. Verify role is active (is_active = TRUE)
3. Check facility_id assignment matches role
4. Verify role has required permissions

```sql
SELECT * FROM user_roles 
WHERE user_id = user_uuid AND is_active = TRUE;

SELECT p.name FROM user_roles ur
INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
INNER JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = user_uuid;
```

### Patient Not Visible

1. Check patient is in assigned facility
2. Verify user has facility access
3. Check patient_status is not 'transferred' or 'deceased'

```sql
SELECT * FROM patients WHERE id = patient_uuid;
SELECT * FROM get_user_accessible_facilities(user_uuid);
```

### Sync Failing

1. Check API key is valid
2. Verify facility is active
3. Check data sync log for errors

```sql
SELECT * FROM data_sync_log 
WHERE facility_id = facility_uuid 
ORDER BY created_at DESC LIMIT 5;
```

## Security Best Practices

1. **Password**: Hash with bcrypt (already implemented)
2. **API Keys**: Use crypto.randomBytes(32) (already implemented)
3. **JWT Tokens**: Set short expiration (15 min access, 24h refresh)
4. **Rate Limiting**: Implement on API endpoints
5. **HTTPS**: Use TLS/SSL in production
6. **Data Validation**: Validate all inputs
7. **SQL Injection**: Use parameterized queries (already implemented)
8. **CORS**: Configure appropriately for frontend domain
9. **Audit**: Review audit logs regularly
10. **Backups**: Daily encrypted backups of data sync

## Next Steps

1. Run migration to create tables
2. Create super admin user
3. Register first facility
4. Create facility admin user
5. Generate API keys
6. Set up facility cron jobs for data sync
7. Configure frontend to use role-based UI
8. Monitor sync operations and audit logs
