# SMS Patient Engagement System Documentation

## Overview

This system enables automated, risk-based SMS messaging to patients for appointment reminders and two-way SMS/WhatsApp conversations. The platform supports three patient risk levels (HIGH, MEDIUM, LOW) with configurable messaging strategies.

---

## Table of Contents

1. [Architecture](#architecture)
2. [System Components](#system-components)
3. [Setup Instructions](#setup-instructions)
4. [API Endpoints](#api-endpoints)
5. [Dashboard Configuration](#dashboard-configuration)
6. [Cron Job Setup](#cron-job-setup)
7. [Examples](#examples)

---

## Architecture

### One-Way SMS (Automated Reminders)
- Triggered by appointment dates
- Risk-level based frequency
- Configurable via dashboard (no coding required)
- Examples:
  - **HIGH Risk**: 6 messages (30, 21, 14, 7, 3, 1 days before)
  - **MEDIUM Risk**: 3 messages (14, 7, 1 days before)
  - **LOW Risk**: 2 messages (14, 1 days before)

### Two-Way SMS/WhatsApp (Conversations)
- Patient-initiated or facility-initiated conversations
- SMS/WhatsApp budget limits per risk level
- Examples:
  - **HIGH Risk**: 1000 messages/month
  - **MEDIUM Risk**: 500 messages/month
  - **LOW Risk**: 200 messages/month

---

## System Components

### Database Tables

#### `patients`
Stores patient information and risk classification
```sql
- id: UUID (primary key)
- phone_number: TEXT (unique)
- facility_id: TEXT (external facility reference)
- patient_name: TEXT
- email: TEXT
- risk_level: ENUM ('HIGH', 'MEDIUM', 'LOW')
- status: ENUM ('active', 'inactive', 'suspended')
- metadata: JSONB (external IDs, custom data)
- created_at, updated_at: TIMESTAMP
```

#### `appointments`
Stores appointment data for scheduling reminders
```sql
- id: UUID (primary key)
- patient_id: UUID (FK to patients)
- facility_id: TEXT
- appointment_date: TIMESTAMP
- appointment_type: TEXT
- status: ENUM ('scheduled', 'completed', 'cancelled', 'no_show')
- notes: TEXT
- created_at, updated_at: TIMESTAMP
```

#### `sms_configurations`
Stores one-way SMS reminder schedules per risk level
```sql
- id: UUID (primary key)
- facility_id: TEXT
- risk_level: ENUM ('HIGH', 'MEDIUM', 'LOW')
- message_timing: JSONB (array of timing objects)
  Example: [
    { "days_before_appointment": 30, "time": "09:00", "enabled": true },
    { "days_before_appointment": 7, "time": "09:00", "enabled": true }
  ]
- enabled: BOOLEAN
- created_at, updated_at: TIMESTAMP
```

#### `sms_budget_limits`
Stores two-way SMS/WhatsApp budget per risk level
```sql
- id: UUID (primary key)
- facility_id: TEXT
- risk_level: ENUM ('HIGH', 'MEDIUM', 'LOW')
- messages_per_month: INTEGER
- messages_per_patient_per_month: INTEGER (optional)
- budget_month_start_day: INTEGER (default: 1)
- enabled: BOOLEAN
- created_at, updated_at: TIMESTAMP
```

#### `message_templates`
Stores SMS message templates
```sql
- id: UUID (primary key)
- facility_id: TEXT
- template_type: TEXT (appointment_reminder, missed_appointment_response, etc.)
- risk_level: TEXT (NULL = applies to all risk levels)
- subject: TEXT
- body: TEXT (with {{placeholders}})
- variables: JSONB (array of variable names)
- enabled: BOOLEAN
- created_at, updated_at: TIMESTAMP
```

#### `sms_sent_messages`
Audit log of all sent SMS messages
```sql
- id: UUID (primary key)
- patient_id: UUID
- facility_id: TEXT
- appointment_id: UUID
- message_type: TEXT (automated_reminder, two_way_conversation)
- phone_number: TEXT
- message_body: TEXT
- channel: ENUM ('sms', 'whatsapp')
- status: ENUM ('sent', 'failed', 'pending', 'delivered')
- external_message_id: TEXT
- sent_at, created_at: TIMESTAMP
```

---

## Setup Instructions

### 1. Database Migration

Run the migration to create the patient engagement schema:

```bash
# Option A: Via PostgreSQL directly
psql -d your_database -f supabase/migrations/20260223_create_patient_engagement_schema.sql

# Option B: Via Supabase CLI
supabase migration up
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Facility data ingestion
FACILITY_API_KEY_VALIDATION=true  # Set to false for testing

# Cron job security
CRON_KEY=your-secret-cron-key

# SMS Provider
SMS_PROVIDER=twilio  # or your provider
SMS_API_KEY=your_api_key
SMS_PHONE_NUMBER=+1234567890
```

### 3. Start the Server

```bash
npm run dev
# or
npm start
```

The SMS configuration dashboard will be available at:
- SMS Configuration: `/sms-configuration`
- Patient Management: `/patient-management`

---

## API Endpoints

### Facility Data Ingestion

#### POST `/api/facilities/patients`
Ingest patient data from facility system

**Headers:**
```
X-Facility-API-Key: your-api-key
X-Facility-ID: facility-123  # optional
```

**Request Body:**
```json
{
  "patients": [
    {
      "patient_id": "EXT-123",
      "phone_number": "+254712345678",
      "patient_name": "John Doe",
      "email": "john@example.com",
      "risk_level": "HIGH",
      "status": "active"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "facility_id": "facility-123",
  "total": 1,
  "results": [
    {
      "patient_id": "EXT-123",
      "phone_number": "+254712345678",
      "success": true,
      "patient_uuid": "550e8400-e29b-41d4-a716-446655440000"
    }
  ]
}
```

#### POST `/api/facilities/appointments`
Ingest appointment data

**Headers:**
```
X-Facility-API-Key: your-api-key
X-Facility-ID: facility-123
```

**Request Body:**
```json
{
  "appointments": [
    {
      "appointment_id": "APT-456",
      "patient_id": "EXT-123",
      "appointment_date": "2026-03-15T14:30:00Z",
      "appointment_type": "checkup",
      "status": "scheduled",
      "notes": "Regular checkup"
    }
  ]
}
```

### SMS Configuration Management

#### GET `/api/sms-admin/configurations`
Get SMS configurations for a facility

**Query Parameters:**
- `facility_id` (required): Facility identifier
- `risk_level` (optional): Filter by risk level (HIGH, MEDIUM, LOW)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "facility_id": "facility-123",
      "risk_level": "HIGH",
      "message_timing": [
        { "days_before_appointment": 30, "time": "09:00", "enabled": true },
        { "days_before_appointment": 7, "time": "09:00", "enabled": true }
      ],
      "enabled": true,
      "created_at": "2026-02-23T10:00:00Z",
      "updated_at": "2026-02-23T10:00:00Z"
    }
  ]
}
```

#### POST `/api/sms-admin/configurations`
Create or update SMS configuration

**Request Body:**
```json
{
  "facility_id": "facility-123",
  "risk_level": "HIGH",
  "message_timing": [
    { "days_before_appointment": 30, "time": "09:00", "enabled": true },
    { "days_before_appointment": 21, "time": "09:00", "enabled": true },
    { "days_before_appointment": 14, "time": "09:00", "enabled": true },
    { "days_before_appointment": 7, "time": "09:00", "enabled": true },
    { "days_before_appointment": 3, "time": "09:00", "enabled": true },
    { "days_before_appointment": 1, "time": "09:00", "enabled": true }
  ],
  "enabled": true
}
```

#### POST `/api/sms-admin/budget-limits`
Create or update SMS budget limits

**Request Body:**
```json
{
  "facility_id": "facility-123",
  "risk_level": "HIGH",
  "messages_per_month": 1000,
  "messages_per_patient_per_month": 100,
  "budget_month_start_day": 1,
  "enabled": true
}
```

#### POST `/api/sms-admin/message-templates`
Create message template

**Request Body:**
```json
{
  "facility_id": "facility-123",
  "template_type": "appointment_reminder",
  "risk_level": "HIGH",
  "subject": "Appointment Reminder",
  "body": "Hi {{patient_name}}, your appointment is scheduled for {{appointment_date}} at {{appointment_time}}. Please reply to confirm.",
  "variables": ["patient_name", "appointment_date", "appointment_time"],
  "enabled": true
}
```

### Cron Job Endpoints

#### POST `/api/crons/process-appointment-reminders`
Process and send automated appointment reminders

**Headers:**
```
X-Cron-Key: your-secret-cron-key
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment reminders processed",
  "totalSent": 42,
  "totalFailed": 2,
  "timestamp": "2026-02-23T10:00:00Z"
}
```

#### GET `/api/crons/status`
Health check for cron service

**Response:**
```json
{
  "success": true,
  "service": "SMS Scheduler Cron",
  "status": "operational",
  "timestamp": "2026-02-23T10:00:00Z"
}
```

---

## Dashboard Configuration

### SMS Configuration Page (SMSConfiguration.tsx)

#### Features:
1. **Appointment Reminders Tab**
   - Configure message timing for each risk level
   - Add/remove message timing rules
   - Enable/disable specific timing rules
   - Real-time previews of configuration

2. **SMS Budget Tab**
   - Set monthly message limits per risk level
   - Optional per-patient limits
   - Budget reset date configuration

3. **Message Templates Tab**
   - Create templates for different message types
   - Use placeholders: `{{patient_name}}`, `{{appointment_date}}`, etc.
   - Template versioning

#### How to Use:
1. Navigate to SMS Configuration page
2. Enter your Facility ID
3. Select risk level to configure
4. Add/edit message timings
5. Save configuration
6. Changes take effect immediately for new appointments

### Patient Management Page (PatientManagement.tsx)

#### Features:
1. View all patients ingested from facility system
2. Filter by risk level
3. Search by name or phone
4. View patient statistics
5. Monitor patient status

---

## Cron Job Setup

### For Linux/Unix (crontab)

#### Every Hour (Recommended)
```bash
0 * * * * curl -X POST http://localhost:5000/api/crons/process-appointment-reminders \
  -H "X-Cron-Key: your-secret-cron-key"
```

#### Every 30 Minutes (For more frequent reminders)
```bash
*/30 * * * * curl -X POST http://localhost:5000/api/crons/process-appointment-reminders \
  -H "X-Cron-Key: your-secret-cron-key"
```

#### Every Day at 6 AM
```bash
0 6 * * * curl -X POST http://localhost:5000/api/crons/process-appointment-reminders \
  -H "X-Cron-Key: your-secret-cron-key"
```

### For Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 6 AM)
4. Action: Start a program
5. Program: `curl.exe`
6. Arguments: 
   ```
   -X POST http://localhost:5000/api/crons/process-appointment-reminders -H "X-Cron-Key: your-secret-cron-key"
   ```

### For Cloud Platforms

#### AWS Lambda + CloudWatch
```python
import requests

def lambda_handler(event, context):
    response = requests.post(
        'http://your-api.com/api/crons/process-appointment-reminders',
        headers={'X-Cron-Key': 'your-secret-cron-key'}
    )
    return {
        'statusCode': response.status_code,
        'body': response.json()
    }
```

#### Google Cloud Scheduler
```bash
gcloud scheduler jobs create http process-reminders \
  --schedule="0 * * * *" \
  --uri="http://your-api.com/api/crons/process-appointment-reminders" \
  --http-method=POST \
  --headers="X-Cron-Key: your-secret-cron-key"
```

---

## Examples

### Complete Facility Integration Example

```javascript
// Facility System Integration (Node.js)

const API_BASE = 'http://your-platform.com/api';
const FACILITY_API_KEY = 'your-facility-api-key';
const FACILITY_ID = 'clinic-001';

async function ingestPatientData() {
  // 1. Get patients from your facility database
  const patients = await getPatientsfromDatabase();

  // 2. Post to the platform
  const response = await fetch(`${API_BASE}/facilities/patients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Facility-API-Key': FACILITY_API_KEY,
      'X-Facility-ID': FACILITY_ID
    },
    body: JSON.stringify({ patients })
  });

  const result = await response.json();
  console.log(`Ingested ${result.total} patients`);
  return result;
}

async function ingestAppointmentData() {
  // Get appointments from your facility system
  const appointments = await getAppointmentsFromDatabase();

  // Post to the platform
  const response = await fetch(`${API_BASE}/facilities/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Facility-API-Key': FACILITY_API_KEY,
      'X-Facility-ID': FACILITY_ID
    },
    body: JSON.stringify({ appointments })
  });

  const result = await response.json();
  console.log(`Ingested ${result.total} appointments`);
  return result;
}

// Schedule this to run after your facility's nightly data sync
schedule('0 2 * * *', async () => {
  await ingestPatientData();
  await ingestAppointmentData();
});
```

### Dashboard Configuration Example

```javascript
// Configure HIGH risk patients for lots of reminders
const highRiskConfig = {
  facility_id: 'clinic-001',
  risk_level: 'HIGH',
  message_timing: [
    { days_before_appointment: 30, time: '09:00', enabled: true },
    { days_before_appointment: 21, time: '09:00', enabled: true },
    { days_before_appointment: 14, time: '09:00', enabled: true },
    { days_before_appointment: 7, time: '09:00', enabled: true },
    { days_before_appointment: 3, time: '09:00', enabled: true },
    { days_before_appointment: 1, time: '09:00', enabled: true }
  ]
};

await fetch('/api/sms-admin/configurations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(highRiskConfig)
});

// Set HIGH risk SMS budget (higher, since they need more support)
const highRiskBudget = {
  facility_id: 'clinic-001',
  risk_level: 'HIGH',
  messages_per_month: 1000,
  messages_per_patient_per_month: 100
};

await fetch('/api/sms-admin/budget-limits', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(highRiskBudget)
});
```

---

## Message Variables Reference

When creating message templates, use these placeholders:

```json
{
  "patient_name": "John Doe",
  "appointment_date": "March 15, 2026",
  "appointment_time": "2:30 PM",
  "appointment_type": "checkup",
  "clinic_name": "Central Health Clinic",
  "days_until": 7,
  "response_reason": "Out of Town"
}
```

### Example Templates:

**Appointment Reminder:**
```
Hi {{patient_name}}, you have an appointment {{days_until}} days away on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm.
```

**Missed Appointment Follow-up:**
```
We noticed you missed your {{appointment_type}} appointment on {{appointment_date}}. You indicated: {{response_reason}}. Please reschedule when ready.
```

---

## Troubleshooting

### Messages Not Sending
1. Check SMS budget hasn't been exceeded
2. Verify appointment dates are in the future
3. Check SMS configuration is enabled
4. Review `sms_sent_messages` table for errors
5. Ensure message template exists

### Cron Job Not Running
1. Verify `X-Cron-Key` header is correct
2. Check server logs for errors
3. Test endpoint manually: `curl -X POST [url] -H "X-Cron-Key: key"`
4. Verify cron job is scheduled correctly

### Facility Data Not Ingesting
1. Verify API key is correct
2. Check phone numbers are in valid E.164 format
3. Review error responses in API response
4. Ensure required fields are present

---

## Security Considerations

1. **API Key Management**
   - Store facility API keys securely
   - Rotate keys periodically
   - Use environment variables, not hardcoded values

2. **Cron Key**
   - Use strong random cron key
   - Restrict cron endpoint to trusted IPs if possible
   - Consider using IP whitelisting

3. **SMS Data**
   - Phone numbers are semi-masked in conversations table
   - Implement rate limiting on SMS sending
   - Audit log all SMS activity via `sms_sent_messages`

4. **Patient Privacy**
   - Comply with local SMS/messaging regulations
   - Implement opt-in/opt-out mechanism
   - Regular backups of sensitive data

---

## Support & Maintenance

For issues or questions:
1. Check this documentation
2. Review API error messages and logs
3. Test endpoints with tools like Postman or curl
4. Monitor system health via `/api/crons/status`
