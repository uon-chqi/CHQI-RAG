# RBAC Implementation Quick Start

## What Was Created

Your healthcare RAG system now has a complete **4-level hierarchical role-based access control system** with:

### 📊 4 Organizational Levels
1. **Super Admin** - Global access to everything
2. **National Admin** - All facilities nationwide
3. **County Admin** - Only facilities in their county
4. **Facility Level** - Staff within their facility

### 👥 8 User Roles
- `super_admin` - Full system access
- `national_admin` - National level management
- `county_admin` - County administration
- `facility_admin` - Facility management
- `facility_manager` - Operational management
- `facility_staff` - Data entry/view
- `data_analyst` - Read-only analysis
- `guest` - Limited access

### 💾 10 Database Tables
- `counties` - Geographic organization
- `facilities` - Healthcare facilities
- `users` - User accounts
- `roles` - Role definitions (8 system roles)
- `permissions` - Permission definitions
- `user_roles` - User-to-role mapping
- `patients` - Patient records
- `patient_ccc_numbers` - Kenya CCC identifiers
- `facility_data_audit` - Audit trail
- `data_sync_log` - Sync tracking

### 🔧 4 Backend Services
1. **AccessControlService** - Permission checking, access filtering
2. **UserManagementService** - User lifecycle, authentication
3. **FacilityService** - Facility management, API keys
4. **PatientDataService** - Patient records with CCC numbers
5. **DataSyncService** - Facility-to-central sync

### 🛡️ Authorization Middleware
- `requirePermission()` - Check specific permissions
- `requireFacilityAdmin()` - Role-based checks
- `requireCountyAdmin()` - Hierarchy checks
- `requireSuperAdmin()` - Super admin only
- `requireFacilityAccess()` - Facility-specific access
- `requirePatientAccess()` - Patient-specific access
- `auditDataAccess()` - Audit logging

### 🌐 API Routes (60+ endpoints)
- **Facilities**: Create, list, update, get stats, generate API keys
- **Users**: Create, manage roles, password reset, list facility users
- **Patients**: Create, search, update, manage CCC numbers, generate reports
- **Data Sync**: Facility push sync, history, statistics
- **Admin Dashboard**: Centralized reporting, audit logs, sync status

## How to Implement

### Step 1: Install Dependencies

```bash
npm install bcrypt jsonwebtoken
# or if using yarn
yarn add bcrypt jsonwebtoken
```

### Step 2: Run Database Migration

```bash
# Using psql
psql -U your_user -d your_database -f supabase/migrations/20260306_create_rbac_system.sql

# Or using Node.js script
node server/scripts/run-migration.js
```

### Step 3: Update Server Entry Point

Add the new routes to your main server file (`server/index.js`):

```javascript
const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Authentication middleware (you need to implement this if not already done)
app.use(authenticationMiddleware); // Verify JWT/session

// Routes
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/rag', require('./routes/rag')); // your existing RAG routes

app.listen(3000, () => console.log('Server running'));
```

### Step 4: Create Super Admin User

```bash
node server/scripts/create-superadmin.js
```

Or manually:

```javascript
// Quick script to run once
const UserManagementService = require('./services/userManagement');
const db = require('./config/database');

async function setup() {
  // Create super admin
  const user = await UserManagementService.createUser({
    email: 'admin@hospital.com',
    firstName: 'System',
    lastName: 'Administrator',
    password: 'ChangeMe123!',
    facilityId: null,
    countyId: null
  }, null);

  // Assign super_admin role
  const roleResult = await db.query(
    "SELECT id FROM roles WHERE name = 'super_admin'"
  );
  
  await db.query(
    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
    [user.id, roleResult.rows[0].id]
  );

  console.log('✓ Super admin created');
  console.log('Email:', user.email);
}

setup().catch(console.error);
```

### Step 5: Create First Facility (as Super Admin)

Super admin logs in and creates first facility:

```bash
curl -X POST http://localhost:3000/api/facilities \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Hospital",
    "code": "HOSP001",
    "countyId": "COUNTY_UUID",
    "facilityType": "hospital",
    "phone": "+254712345678",
    "email": "hospital@example.com"
  }'
```

### Step 6: Add County (if not exists)

```bash
curl -X INSERT http://localhost:3000/api/counties \
  -d '{
    "name": "Nairobi",
    "code": "NRB",
    "region": "Central"
  }'
```

Or directly in SQL:

```sql
INSERT INTO counties (name, code, region) VALUES 
('Nairobi', 'NRB', 'Central');
```

### Step 7: Create Facility Admin

Super admin creates facility admin user:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hospital.com",
    "firstName": "John",
    "lastName": "Manager",
    "password": "SecurePass123!",
    "facilityId": "FACILITY_UUID",
    "jobTitle": "Hospital Administrator"
  }'
```

### Step 8: Assign Role to Facility Admin

```bash
curl -X POST http://localhost:3000/api/users/USER_UUID/roles \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleId": "FACILITY_ADMIN_ROLE_UUID",
    "facilityId": "FACILITY_UUID"
  }'
```

### Step 9: Generate API Key for Data Sync

Facility admin generates API key:

```bash
curl -X POST http://localhost:3000/api/facilities/FACILITY_UUID/api-key \
  -H "Authorization: Bearer JWT_TOKEN"
```

Response:
```json
{
  "facilityId": "...",
  "apiKey": "very_long_secret_key",
  "createdAt": "...",
  "note": "Save this securely!"
}
```

### Step 10: Set Up Facility Data Sync

In facility's system, create cron job:

```javascript
// facility-system/sync-to-central.js
const axios = require('axios');

async function syncPatientData() {
  const patients = await getPatientsDueForSync();
  
  try {
    const response = await axios.post(
      'https://central-server.com/api/sync/data',
      {
        syncType: 'incremental',
        patients: patients.map(p => ({
          firstName: p.first_name,
          lastName: p.last_name,
          dateOfBirth: p.dob,
          gender: p.gender,
          phone: p.phone,
          nationalId: p.national_id,
          cccNumber: p.ccc_number,
          enrollmentDate: p.enrollment_date,
          chronicConditions: p.conditions || [],
          allergies: p.allergies || []
        }))
      },
      {
        headers: {
          'X-Facility-ID': process.env.FACILITY_ID,
          'X-Facility-API-Key': process.env.FACILITY_API_KEY
        }
      }
    );

    console.log('Sync successful:', response.data);
    markPatientsSynced(patients);
  } catch (error) {
    console.error('Sync failed:', error.response?.data || error.message);
  }
}

// Run every day at 2 AM
const cron = require('node-cron');
cron.schedule('0 2 * * *', syncPatientData);
```

## Testing the System

### 1. Test Super Admin Access (All Facilities)

```bash
curl http://localhost:3000/api/facilities \
  -H "Authorization: Bearer SUPER_ADMIN_JWT"
```
Response: All facilities ✓

### 2. Test County Admin Access (Filtered)

```bash
curl http://localhost:3000/api/facilities \
  -H "Authorization: Bearer COUNTY_ADMIN_JWT"
```
Response: Only county facilities ✓

### 3. Test Facility Staff Access

```bash
curl http://localhost:3000/api/patients \
  -H "Authorization: Bearer STAFF_JWT"
```
Response: Only facility patients ✓

### 4. Test Patient Creation

```bash
curl -X POST http://localhost:3000/api/patients/facility/FACILITY_ID/create \
  -H "Authorization: Bearer STAFF_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-15",
    "gender": "male",
    "phone": "+254712345678",
    "nationalId": "12345678",
    "bloodGroup": "O+"
  }'
```

### 5. Test Data Sync (without auth)

```bash
curl -X POST http://localhost:3000/api/sync/data \
  -H "X-Facility-ID: FACILITY_UUID" \
  -H "X-Facility-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "syncType": "incremental",
    "patients": [
      {
        "firstName": "Jane",
        "lastName": "Smith",
        "dateOfBirth": "1995-05-20",
        "gender": "female",
        "phone": "+254712987654",
        "cccNumber": "11111/2024/00001",
        "enrollmentDate": "2024-01-15"
      }
    ]
  }'
```

### 6. Check Audit Log

```bash
curl http://localhost:3000/api/admin/audit-log \
  -H "Authorization: Bearer SUPER_ADMIN_JWT"
```

## File Structure

```
server/
├── services/
│   ├── accessControl.js      ← Access control logic
│   ├── userManagement.js     ← User lifecycle
│   ├── facilityManagement.js ← Facility operations
│   ├── patientData.js        ← Patient records
│   └── dataSync.js           ← Data synchronization
├── middleware/
│   └── authorization.js      ← Role-based middleware
└── routes/
    ├── facilities.js         ← Facility endpoints
    ├── users.js             ← User management endpoints
    ├── patients.js          ← Patient endpoints
    ├── sync.js              ← Data sync endpoints
    └── admin.js             ← Admin dashboard endpoints

supabase/migrations/
└── 20260306_create_rbac_system.sql  ← Database schema
```

## Key Features

✅ **Hierarchical Access Control** - 4 organizational levels
✅ **Role-Based Permissions** - 8 predefined roles + custom
✅ **Facility Isolation** - Each facility owns their data
✅ **Audit Trail** - All operations logged
✅ **Data Sync** - Central database aggregation
✅ **API Keys** - Secure facility authentication
✅ **Multi-facility Search** - Find patients across facilities
✅ **CCC Support** - Kenya-specific patient identifiers
✅ **Reports** - Date-range based data extraction
✅ **Super Admin Dashboard** - Centralized operations

## Common Use Cases

### Use Case 1: Clinic Pushes Daily Patient Data

1. Clinic generates API key
2. Set up daily cron job that posts to `/api/sync/data`
3. Central database automatically receives updates
4. Super admin sees all data consolidated

### Use Case 2: County Admin Views County Facilities

1. County admin logs in
2. **GET** `/api/facilities` returns only their county facilities
3. **GET** `/api/patients` returns only their county patients
4. Can create reports for county health ministry

### Use Case 3: Super Admin Exports National Data

1. Super admin logs in
2. **GET** `/api/admin/facilities-data` returns ALL patient data
3. CSV export for national health analytics
4. Compliance audit trail available at `/api/admin/audit-log`

## Troubleshooting

**Problem**: User cannot see facilities
```bash
# Check user's roles and permissions
SELECT * FROM user_roles WHERE user_id = 'UUID';
SELECT * FROM role_permissions WHERE role_id = 'ROLE_UUID';
```

**Problem**: Sync fails with API key error
```bash
# Verify API key is stored
SELECT api_key_hash FROM facilities WHERE id = 'FACILITY_UUID';
# Generate new key if needed
POST /api/facilities/FACILITY_UUID/api-key
```

**Problem**: Patient not visible in another facility
- By design! Patients are facility-isolated
- Only super admin and national admin see cross-facility patients
- Use `/api/admin/facilities-data` endpoint

## Security Checklist

- [ ] Change super admin default password
- [ ] Use HTTPS/TLS in production
- [ ] Set proper JWT expiration times
- [ ] Enable rate limiting on API
- [ ] Regular audit log review
- [ ] Database backups daily
- [ ] API keys rotated quarterly
- [ ] CORS configured properly
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (using parameterized queries)

## Next: Frontend Integration

Your React frontend should:

1. Get user roles via `/api/users/profile`
2. Filter UI elements based on hierarchy_level
3. Use `/api/users/me/permissions` to enable/disable features
4. Send API requests only to accessible facilities
5. Show facility selector if user has multiple facilities

## Support

For questions or issues, refer to:
- `RBAC_SETUP_GUIDE.md` - Detailed documentation
- `database-schema.sql` - Existing schema
- Service files - Code comments and function docs
