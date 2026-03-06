# RBAC System - Visual Architecture & Data Flow

## 🏛️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CENTRALIZED HEALTHCARE SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────┐                                                 │
│  │  SUPER ADMIN           │  Level: 100  Scope: Global                      │
│  │  - All facilities      │  Can: Everything                                │
│  │  - All users           │  See: All data nationwide                       │
│  └────────┬───────────────┘                                                 │
│           │                                                                  │
│           │ delegates                                                       │
│           │                                                                  │
│  ┌────────▼───────────────┐                                                 │
│  │  NATIONAL ADMIN        │  Level: 80  Scope: National                     │
│  │  - All facilities      │  Can: Create facilities, manage users           │
│  │  - All regions         │  See: All data across regions                   │
│  └────────┬───────────────┘                                                 │
│           │                                                                  │
│           │ manages                                                         │
│           │                                                                  │
│  ┌────────▼───────────────┐                     ┌─────────┐                │
│  │  COUNTY ADMIN 1        │─ County 1          │ COUNTY 2│  COUNTY 3       │
│  │  - Their facilities    │                     │ ADMIN   │                │
│  │  - County users        │  Level: 60          └─────────┘                │
│  │  - County data only    │  Scope: County                                 │
│  └────────┬───────────────┘                                                 │
│           │                                                                  │
│           │ manages                                                         │
│           ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────┐              │
│   │  FACILITIES IN COUNTY                                   │              │
│   │  - Kenyatta Nat'l Hospital (Hospital)                  │              │
│   │  - County Health Centre (Clinic)                       │              │
│   │  - Nairobi Dispensary (Dispensary)                     │              │
│   │  - ...more facilities...                              │              │
│   └──┬───────────────────────────────────────────┬─────────┘              │
│      │                                            │                         │
│      ▼                                            ▼                         │
│   ┌──────────────────┐                    ┌──────────────────┐            │
│   │ FACILITY ADMIN   │                    │ FACILITY ADMIN   │            │
│   │ Level: 40        │                    │ Level: 40        │            │
│   │ This facility    │                    │ This facility    │            │
│   └──┬───────────────┘                    └──┬───────────────┘            │
│      │                                        │                             │
│  ┌───┴────┬──────────┬──────────┐            │                            │
│  │         │          │          │            │                            │
│  ▼         ▼          ▼          ▼            ▼                            │
│┌────────┐ ┌──────────┐ ┌───────┐ ┌────────┐ ┌──────────────────┐         │
│ Manager │ │  Staff   │ │ Staff │ │Analyst │ │ OTHER FACILITY   │         │
│ L:30    │ │  L:20    │ │ L:20  │ │ L:25   │ │ Users/Data       │         │
│ Ops     │ │ Data     │ │ Data  │ │ Reports│ │ (Isolated)       │         │
│ mgmt    │ │ entry    │ │ entry │ │ only   │ │                  │         │
└────────┘ └──────────┘ └───────┘ └────────┘ └──────────────────┘         │
│                                                                              │
├─────── CENTRAL DATABASE LAYER ─────────────────────────────────────────────│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     PostgreSQL Database                              │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ COUNTIES     │  │ FACILITIES   │  │ PATIENTS                 │  │  │
│  │  │              │  │              │  │                          │  │  │
│  │  │ - Nairobi    │  │ - KNH        │  │ - John Doe              │  │  │
│  │  │ - Kiambu     │  │ - NHCC       │  │ - Jane Smith             │  │  │
│  │  │ - Nakuru     │  │ - Dispensary │  │ - Patient CCC: 11111/..  │  │  │
│  │  │ ...          │  │ ...          │  │ ...                      │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ USERS        │  │ ROLES        │  │ PATIENT_CCC_NUMBERS      │  │  │
│  │  │              │  │              │  │                          │  │  │
│  │  │ - Super Admin│  │ - super_admin│  │ - 11111/2024/00001       │  │  │
│  │  │ - NationalA  │  │ - national_a │  │ - 11111/2024/00002       │  │  │
│  │  │ - CountyA    │  │ - county_...│  │ - 11111/2024/00003      │  │  │
│  │  │ - FacStaff   │  │ - facility..│  │ ...                      │  │  │
│  │  │ ...          │  │ ...          │  │                          │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────────────────────────────────────┐  │ │
│  │  │ AUDIT TRAIL  │  │ DATA SYNC LOG (Facility → Central)           │  │
│  │  │              │  │                                              │  │
│  │  │ Who: user_id │  │ - Sync Type: incremental/full              │  │
│  │  │ What: op     │  │ - Facility: F001                            │  │
│  │  │ When: ts     │  │ - Status: completed/error                   │  │
│  │  │ Where: IP    │  │ - Records: 150 synced                       │  │
│  │  │ Why: changes │  │ - Hash: a1b2c3d4...                         │  │
│  │  │ ...          │  │ - Timestamp: 2026-03-06 14:30:00            │  │
│  │  └──────────────┘  │ ...                                          │  │
│  │                    └──────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Access Control Flow

```
USER REQUEST
    │
    ├─ JWT Token (Header: Authorization: Bearer <JWT>)
    │
    ▼
┌──────────────────────────────────────┐
│   AUTHENTICATION MIDDLEWARE          │
│   - Verify JWT signature             │
│   - Extract user_id from token       │
│   - Return 401 if invalid            │
└──────────┬───────────────────────────┘
           │ ✓ Valid token, continue
           │
           ▼
┌──────────────────────────────────────┐
│   AUTHORIZATION MIDDLEWARE #1        │
│   - Check if user exists & is active │
│   - Verify role assignment           │
│   - Return 403 if unauthorized       │
└──────────┬───────────────────────────┘
           │ ✓ User authorized, continue
           │
           ├─ requirePermission()  ──────────► Check specific permission
           │  (e.g., 'patient:create')      from user's roles
           │
           ├─ requireFacilityAdmin()  ───────► Check hierarchy level >= 40
           │
           ├─ requireCountyAdmin()  ────────► Check hierarchy level >= 60
           │
           ├─ requireSuperAdmin()  ─────────► Check hierarchy level >= 100
           │
           ├─ requireFacilityAccess()  ─────► Verify can access facility_id
           │
           └─ requirePatientAccess()  ──────► Verify can access patient
           │
           ▼
┌──────────────────────────────────────┐
│   SERVICE LAYER                      │
│   (PatientDataService, etc.)         │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│   ACCESS CONTROL SERVICE             │
│   - getUserAccessibleFacilities()    │
│   - Returns facility_ids user can    │
│   access based on role               │
│                                       │
│   Super Admin   → [All facilities]    │
│   National Admin → [All facilities]   │
│   County Admin → [County facilities]  │
│   Facility staff → [Their facility]   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│   BUILD SQL QUERY                    │
│                                       │
│   SELECT * FROM patients             │
│   WHERE facility_id IN (...)         │
│     AND gender = $1                  │
│     AND status = $2                  │
│   ORDER BY created_at DESC           │
│                                       │
│   The WHERE IN uses only facilities  │
│   the user can access!               │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│   QUERY DATABASE                     │
│   Results automatically filtered     │
│   No unauthorized data returned      │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│   AUDIT DATA ACCESS MIDDLEWARE       │
│                                       │
│   Log to facility_data_audit:        │
│   - user_id: <who>                   │
│   - facility_id: <where>             │
│   - operation_type: 'read'           │
│   - table_name: 'patients'           │
│   - timestamp: NOW()                 │
│   - ip_address: <source>             │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│   RETURN RESULTS TO USER             │
│   - Filtered by access rights        │
│   - Logged in audit trail            │
│   - Timestamp included               │
└──────────────────────────────────────┘
```

---

## 🔄 Facility Data Sync Flow

```
FACILITY SYSTEM                          CENTRAL SYSTEM

┌─────────────────────┐
│  Daily Cron Job     │
│  (2:00 AM)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Query Local Database for:              │
│  - New patients since last sync         │
│  - Updated patient records              │
│  - CCC number enrollments               │
│  - Patient encounters/visits            │
└──────────┬────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Format Patient Data:                   │
│  {                                      │
│    "syncType": "incremental",          │
│    "patients": [                        │
│      {                                  │
│        "firstName": "John",            │
│        "lastName": "Doe",              │
│        "dateOfBirth": "1980-01-15",    │
│        "phone": "+254712345678",       │
│        "nationalId": "12345678",       │
│        "cccNumber": "1111/2024/00001", │
│        "enrollmentDate": "2024-01-15", │
│        "bloodGroup": "O+",             │
│        "chronicConditions": [...],     │
│        "allergies": [...],             │
│        "currentMedications": [...]     │
│      },                                 │
│      ...                                │
│    ]                                    │
│  }                                      │
└──────────┬────────────────────────────────┘
           │
           ▼
                                          ┌────────────────────────────┐
                                          │ POST /api/sync/data        │
                                          │                            │
                                          │ Headers:                   │
                                          │ X-Facility-ID: FAC123     │
                                          │ X-Facility-API-Key: key..│
                                          │                            │
                                          │ Body: Patient JSON Data   │
                                          └────────┬───────────────────┘
                                                   │
                                                   ▼
                                          ┌────────────────────────────┐
                                          │ DataSyncService:           │
                                          │ - Verify API key hash     │
                                          │ - Validate facility exists│
                                          │ - Check is_active         │
                                          └────────┬───────────────────┘
                                                   │
                                          ┌────────▼───────────────────┐
                                          │ For each patient:          │
                                          │                            │
                                          │ 1. Check if exists by     │
                                          │    national_id             │
                                          │                            │
                                          │ 2. If exists:             │
                                          │    UPDATE patients         │
                                          │                            │
                                          │ 3. If not exists:         │
                                          │    INSERT new patient     │
                                          │                            │
                                          │ 4. Add/update CCC number  │
                                          │                            │
                                          └────────┬───────────────────┘
                                                   │
                                                   ▼
                                          ┌────────────────────────────┐
                                          │ Log Sync Operation:        │
                                          │   data_sync_log            │
                                          │                            │
                                          │ facility_id: FAC123        │
                                          │ sync_type: incremental     │
                                          │ table_name: patients       │
                                          │ records_synced: 150        │
                                          │ sync_status: completed     │
                                          │ data_hash: a1b2c3d4...     │
                                          │ started_at: 2:00:00        │
                                          │ completed_at: 2:05:32      │
                                          │ duration_ms: 332           │
                                          └────────┬───────────────────┘
                                                   │
                                                   ▼
                                          ┌────────────────────────────┐
                                          │ CENTRAL DATABASE UPDATED   │
                                          │                            │
                                          │ - 150 patients synced     │
                                          │ - CCC numbers added       │
                                          │ - Audit trail recorded    │
                                          │ - Sync marked successful  │
                                          └────────┬───────────────────┘
                                                   │
                                                   ▼
                                          ┌────────────────────────────┐
                                          │ Return to Facility:        │
                                          │ {                          │
                                          │   "success": true,         │
                                          │   "synced": 150,           │
                                          │   "errors": 0              │
                                          │ }                          │
                                          └────────────────────────────┘
```

---

## 👥 User Access Examples

### Super Admin - Views All Facilities

```sql
GET /api/facilities
↓ MySQL Query ↓
SELECT f.* FROM facilities f
(NO WHERE clause - sees all)
↓ Result ↓
✓ Kenyatta National Hospital (Nairobi County)
✓ Kiambu Teaching Hospital (Kiambu County)
✓ Nakuru General Hospital (Nakuru County)
✓ Kisumu County Hospital (Kisumu County)
All 47 facilities in the database
```

### County Admin (Nairobi) - Views Only County Facilities

```sql
GET /api/facilities
↓ Middleware: get_user_accessible_facilities(user_uuid) ↓
SELECT f.* FROM facilities f
WHERE f.county_id IN (SELECT ur.county_id FROM user_roles ur WHERE ur.user_id = 'COUNTY_ADMIN')
↓ Result ↓
✓ Kenyatta National Hospital (Nairobi County)
✓ Nairobi County Health Centre (Nairobi County)
✓ Nairobi Dispensary (Nairobi County)
Only 3 facilities in Nairobi County
```

### Facility Staff - Views Only Their Facility

```sql
GET /api/patients
↓ Middleware: getUserAccessibleFacilities(user_uuid) ↓
SELECT p.* FROM patients p
WHERE p.facility_id IN ('FAC123')  -- Their single facility
↓ Result ✓
✓ John Doe (CCC: 11111/2024/00001)
✓ Jane Smith (CCC: 11111/2024/00002)
✓ Mike Johnson (CCC: 11111/2024/00003)
Only patients from their facility (100 patients)
```

---

## 🗝️ Permission Hierarchy

```
PERMISSIONS STRUCTURE:

√ super_admin Role
  ├─ facility:view        ✓
  ├─ facility:create      ✓
  ├─ facility:edit        ✓
  ├─ facility:delete      ✓
  ├─ user:view            ✓
  ├─ user:create          ✓
  ├─ user:edit            ✓
  ├─ user:delete          ✓
  ├─ user:manage_roles    ✓
  ├─ patient:view         ✓
  ├─ patient:create       ✓
  ├─ patient:edit         ✓
  ├─ patient:delete       ✓
  ├─ data:export          ✓
  ├─ data:audit           ✓
  ├─ system:manage        ✓
  └─ system:view_logs     ✓

√ national_admin Role
  ├─ facility:view        ✓
  ├─ facility:create      ✓
  ├─ facility:edit        ✓
  ├─ user:view            ✓
  ├─ user:create          ✓
  ├─ user:edit            ✓
  ├─ user:manage_roles    ✓
  ├─ patient:view         ✓
  ├─ patient:create       ✓
  ├─ patient:edit         ✓
  ├─ data:export          ✓
  └─ data:audit           ✓

√ county_admin Role
  ├─ facility:view        ✓
  ├─ user:view            ✓
  ├─ user:create          ✓
  ├─ user:edit            ✓
  ├─ patient:view         ✓
  ├─ patient:create       ✓
  ├─ patient:edit         ✓
  ├─ data:export          ✓
  └─ data:audit           ✓

√ facility_admin Role
  ├─ facility:view        ✓
  ├─ user:view            ✓
  ├─ user:create          ✓
  ├─ user:edit            ✓
  ├─ user:manage_roles    ✓
  ├─ patient:view         ✓
  ├─ patient:create       ✓
  ├─ patient:edit         ✓
  ├─ patient:delete       ✓
  ├─ data:export          ✓
  └─ data:audit           ✓

√ facility_manager Role
  ├─ facility:view        ✓
  ├─ user:view            ✓
  ├─ patient:view         ✓
  ├─ patient:create       ✓
  ├─ patient:edit         ✓
  └─ data:export          ✓

√ facility_staff Role
  ├─ patient:view         ✓
  ├─ patient:create       ✓
  └─ patient:edit         ✓

√ data_analyst Role
  ├─ patient:view         ✓
  └─ data:export          ✓

√ guest Role
  └─ patient:view (limited) ✓
```

---

## 📈 Query Examples by Role

### Super Admin - Export All National Data

```sql
GET /api/admin/facilities-data

SELECT DISTINCT
  p.id, p.first_name, p.last_name, p.phone, p.national_id,
  f.name as facility_name, c.name as county_name,
  pcn.ccc_number
FROM patients p
INNER JOIN facilities f ON p.facility_id = f.id
INNER JOIN counties c ON f.county_id = c.id
LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id
-- NO WHERE clause - sees ALL data!

Result: 50,000 patients across 47 facilities in 6 counties
```

### County Admin - County Summary Report

```sql
GET /api/admin/county/:countyId/dashboard

SELECT
  c.name, c.code,
  COUNT(DISTINCT f.id) as facility_count,
  COUNT(DISTINCT p.id) as total_patients,
  COUNT(DISTINCT pcn.id) as active_ccc_enrollment
FROM counties c
LEFT JOIN facilities f ON c.id = f.county_id
LEFT JOIN patients p ON f.id = p.facility_id
LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id 
WHERE c.id = $1
GROUP BY c.id, c.name, c.code

Result:
Nairobi County
- Facilities: 3
- Total Patients: 2,500
- Active CCC Enrollments: 1,800
```

### Facility Staff - Patient List

```sql
GET /api/patients/facility/:facilityId/list

SELECT p.id, p.first_name, p.last_name, p.phone,
  pcn.ccc_number, p.created_at
FROM patients p
LEFT JOIN patient_ccc_numbers pcn ON p.id = pcn.patient_id
WHERE p.facility_id = $1  -- Only their facility!
ORDER BY p.created_at DESC
LIMIT 50

Result: 50 most recent patients from their facility only
(Even if they try to change facilityId, middleware blocks it!)
```

---

## 🔐 Security: Audit Trail Example

```
USER ACTION: Update Patient Blood Group

→ INSERT INTO facility_data_audit VALUES:
{
  id: '550e8400-e29b-41d4-a716-446655440000',
  facility_id: '660e8400-e29b-41d4-a716-446655440000',
  user_id: '770e8400-e29b-41d4-a716-446655440000',
  operation_type: 'update',
  table_name: 'patients',
  record_id: '880e8400-e29b-41d4-a716-446655440000',
  
  old_values: {
    blood_group: 'O+',
    updated_at: '2026-03-06 10:00:00'
  },
  new_values: {
    blood_group: 'A+',
    updated_at: '2026-03-06 14:30:00'
  },
  changes: {
    blood_group: { from: 'O+', to: 'A+' }
  },
  
  ip_address: '192.168.1.100',
  user_agent: 'Mozilla/5.0...',
  request_id: 'req-20260306-443',
  
  is_compliant: true,
  compliance_notes: null,
  
  created_at: '2026-03-06 14:30:00'
}

→ Super admin can query:
SELECT * FROM facility_data_audit
WHERE facility_id = '660e8400...'
  AND created_at >= '2026-03-01'
  AND created_at < '2026-03-07'
ORDER BY created_at DESC

→ RESULT: Full compliance audit trail for entire month at facility!
```

---

## 📊 Sync Status Dashboard

```
GET /api/admin/sync-status

Result:
┌─────────────────────────────────────────────────────────┐
│ Facility                │ Last Sync    │ Status │ Count │
├─────────────────────────────────────────────────────────┤
│ Kenyatta Nat'l Hospital │ 2:05 AM ✓    │ OK     │ 150   │
│ County Health Centre    │ 2:03 AM ✓    │ OK     │ 45    │
│ Nairobi Dispensary      │ 2:30 AM ✓    │ OK     │ 23    │
│ Nakuru General          │ 1:45 AM ✓    │ OK     │ 200   │
│ Kisumu County           │ ERROR ✗      │ FAIL   │ 0     │
│ Mombasa Teaching        │ 2:00 AM ✓    │ OK     │ 120   │
├─────────────────────────────────────────────────────────┤
│ TOTAL:                  │              │        │ 538   │
│ Successful:             │ 5/6 (83%)    │        │       │
│ Failed:                 │ 1/6 (17%)    │        │       │
└─────────────────────────────────────────────────────────┘

→ Admin can see:
  - Which facilities synced successfully
  - Which ones failed (Kisumu - needs attention!)
  - How much data was synced
  - Timing of each sync
```

---

This architecture ensures:
✅ **Complete Isolation** - Facility data never mixed
✅ **Audit Trail** - Every action logged with details
✅ **Hierarchy Enforcement** - Access controlled at every level
✅ **Data Sync** - Facilities push to central DB reliably
✅ **Scalability** - Supports unlimited facilities & counties
✅ **Security** - Hashed passwords, API keys, parameterized SQL
