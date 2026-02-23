# SMS Patient Engagement System - Quick Start Guide

## What's Been Implemented

A **complete SMS patient engagement platform** with:

✅ **One-Way SMS Automation** - Appointment reminders on configurable schedules
✅ **Risk-Based Messaging** - Different frequencies for HIGH/MEDIUM/LOW risk patients
✅ **Two-Way SMS/WhatsApp Budget** - Configurable message limits per risk level
✅ **Dashboard Management** - Configure everything via UI (no coding required)
✅ **Facility Data Integration** - API for ingesting patient & appointment data
✅ **Message Templates** - Customizable SMS templates with variable substitution
✅ **Audit Logging** - Track all sent messages for compliance

---

## Files Created

### 1. **Database Migration**
```
supabase/migrations/20260223_create_patient_engagement_schema.sql
```
- Tables: patients, appointments, sms_configurations, sms_budget_limits, message_templates, sms_sent_messages

### 2. **Backend API Routes**

**`server/routes/facilities.js`** - Facility data ingestion
- `POST /api/facilities/patients` - Ingest patient data
- `POST /api/facilities/appointments` - Ingest appointment data
- `GET /api/facilities/status` - Health check

**`server/routes/sms-admin.js`** - SMS configuration management
- `GET|POST /api/sms-admin/configurations` - Manage appointment reminder schedule
- `GET|POST /api/sms-admin/budget-limits` - Manage SMS/WhatsApp budget
- `GET|POST /api/sms-admin/message-templates` - Manage message templates

**`server/routes/crons.js`** - Scheduled job processing
- `POST /api/crons/process-appointment-reminders` - Process & send reminders
- `GET /api/crons/status` - Service health check

### 3. **Services**

**`server/services/smsScheduler.js`** - Core SMS scheduling logic
- Processes appointments and sends reminders on schedule
- Budget checking and enforcement
- Message template formatting
- Audit logging

### 4. **Dashboard Pages**

**`src/pages/SMSConfiguration.tsx`** - Admin configuration interface
- Configure appointment reminder timing per risk level
- Set SMS/WhatsApp budget limits
- Create and manage message templates
- Real-time changes take effect immediately

**`src/pages/PatientManagement.tsx`** - Patient data management
- View all patients
- Filter by risk level
- Search by name/phone
- View patient statistics

---

## 5-Minute Setup

### Step 1: Run Database Migration
```bash
psql -d your_database -f supabase/migrations/20260223_create_patient_engagement_schema.sql
```

### Step 2: Update `.env`
```env
CRON_KEY=your-secret-cron-key-change-this
```

### Step 3: Start Server
```bash
npm run dev
```

### Step 4: Access Dashboard
- **SMS Configuration**: http://localhost:5000/app (navigate to SMS Configuration)
- **Patient Management**: http://localhost:5000/app (navigate to Patient Management)

### Step 5: Set Up Cron Job
For Linux/macOS, add to crontab:
```bash
0 * * * * curl -X POST http://localhost:5000/api/crons/process-appointment-reminders -H "X-Cron-Key: your-secret-cron-key-change-this"
```

---

## How It Works

### 1. Data Ingestion Flow
```
Your Facility System
        ↓
    Cron Job (daily/hourly)
        ↓
POST /api/facilities/patients & /api/facilities/appointments
        ↓
PostgreSQL Database
```

**Example Facility Cron Job (Node.js):**
```javascript
// Run daily at 2 AM
schedule('0 2 * * *', async () => {
  const patients = await getPatientsfromYourDatabase();
  const appointments = await getAppointmentsfromYourDatabase();

  await fetch('http://your-platform.com/api/facilities/patients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Facility-API-Key': 'your-api-key',
      'X-Facility-ID': 'your-facility-id'
    },
    body: JSON.stringify({ patients })
  });

  // Similarly for appointments
});
```

### 2. Message Scheduling Flow
```
Appointment Created
        ↓
Cron Job Runs Hourly
        ↓
Check: Is this appointment within 30 days?
Check: Should a message be sent today?
Check: Has this message already been sent?
Check: Is SMS budget available?
        ↓
Get Message Template
        ↓
Format with Patient Data
        ↓
Send SMS via Provider
        ↓
Log to sms_sent_messages table
```

### 3. Configuration Example

**For HIGH Risk Patients:**
```json
{
  "facility_id": "clinic-001",
  "risk_level": "HIGH",
  "message_timing": [
    { "days_before_appointment": 30, "time": "09:00", "enabled": true },
    { "days_before_appointment": 21, "time": "09:00", "enabled": true },
    { "days_before_appointment": 14, "time": "09:00", "enabled": true },
    { "days_before_appointment": 7, "time": "09:00", "enabled": true },
    { "days_before_appointment": 3, "time": "09:00", "enabled": true },
    { "days_before_appointment": 1, "time": "09:00", "enabled": true }
  ]
}
```

**For MEDIUM Risk Patients:**
```json
{
  "facility_id": "clinic-001",
  "risk_level": "MEDIUM",
  "message_timing": [
    { "days_before_appointment": 14, "time": "09:00", "enabled": true },
    { "days_before_appointment": 7, "time": "09:00", "enabled": true },
    { "days_before_appointment": 1, "time": "09:00", "enabled": true }
  ]
}
```

**For LOW Risk Patients:**
```json
{
  "facility_id": "clinic-001",
  "risk_level": "LOW",
  "message_timing": [
    { "days_before_appointment": 14, "time": "09:00", "enabled": true },
    { "days_before_appointment": 1, "time": "09:00", "enabled": true }
  ]
}
```

---

## Key Features Explained

### 🎯 Risk-Based Messaging
Different patient types get different message frequencies:
- **HIGH**: 6 messages before appointment (aggressive engagement)
- **MEDIUM**: 3 messages before appointment (standard engagement)
- **LOW**: 2 messages before appointment (minimal engagement)

### 💬 Configurable Timing
Change when messages are sent WITHOUT code:
1. Open dashboard
2. Select risk level
3. Modify days/times
4. Save
5. **Done!** Changes apply to next appointments

### 📊 Budget Control
Prevent message overload:
- Set monthly SMS limits per facility
- Optional per-patient limits
- Budget tracking and enforcement

### 🔄 Two-Way SMS Support
Track and limit patient-initiated conversations:
- HIGH risk: 1000 messages/month
- MEDIUM risk: 500 messages/month
- LOW risk: 200 messages/month

### 📝 Message Templates
Customize messages with variables:
```
Hi {{patient_name}}, 
your appointment is {{days_until}} days away on {{appointment_date}}.
Reply YES to confirm.
```

---

## API Quick Reference

### Ingest Patients
```bash
curl -X POST http://localhost:5000/api/facilities/patients \
  -H "X-Facility-API-Key: your-key" \
  -H "X-Facility-ID: your-facility-id" \
  -H "Content-Type: application/json" \
  -d '{
    "patients": [
      {
        "patient_id": "EXT-123",
        "phone_number": "+254712345678",
        "patient_name": "John Doe",
        "risk_level": "HIGH"
      }
    ]
  }'
```

### Configure Reminders
```bash
curl -X POST http://localhost:5000/api/sms-admin/configurations \
  -H "Content-Type: application/json" \
  -d '{
    "facility_id": "clinic-001",
    "risk_level": "HIGH",
    "message_timing": [
      {"days_before_appointment": 7, "time": "09:00", "enabled": true},
      {"days_before_appointment": 1, "time": "09:00", "enabled": true}
    ]
  }'
```

### Trigger Reminders (Manual)
```bash
curl -X POST http://localhost:5000/api/crons/process-appointment-reminders \
  -H "X-Cron-Key: your-secret-cron-key"
```

---

## Database Schema Overview

```
patients
├── id (UUID)
├── phone_number (TEXT, UNIQUE)
├── facility_id (TEXT)
├── patient_name (TEXT)
├── risk_level (HIGH|MEDIUM|LOW)
└── created_at (TIMESTAMP)

appointments
├── id (UUID)
├── patient_id (FK → patients)
├── appointment_date (TIMESTAMP)
└── status (scheduled|completed|cancelled|no_show)

sms_configurations
├── facility_id (TEXT)
├── risk_level (HIGH|MEDIUM|LOW)
├── message_timing (JSON array)
└── enabled (BOOLEAN)

sms_budget_limits
├── facility_id (TEXT)
├── risk_level (HIGH|MEDIUM|LOW)
├── messages_per_month (INTEGER)
└── enabled (BOOLEAN)

message_templates
├── facility_id (TEXT)
├── template_type (TEXT)
├── risk_level (HIGH|MEDIUM|LOW|NULL)
└── body (TEXT with {{placeholders}})

sms_sent_messages (Audit Log)
├── patient_id (FK)
├── message_type (TEXT)
├── status (sent|failed|pending)
└── created_at (TIMESTAMP)
```

---

## Next Steps

1. **Test Integration**
   ```bash
   # Test facility API
   curl -X GET http://localhost:5000/api/facilities/status \
     -H "X-Facility-API-Key: test-key" \
     -H "X-Facility-ID: test-facility"
   ```

2. **Configure Your Facility**
   - Get a Facility API Key
   - Set up daily data sync from your system
   - Configure SMS reminders in dashboard

3. **Set Up Cron Job**
   - Configure hourly or daily processing
   - Monitor logs for sending status

4. **Customize Templates**
   - Create message templates for your clinic
   - Use patient variables for personalization

5. **Monitor & Optimize**
   - Review `sms_sent_messages` table
   - Check delivery rates
   - Adjust timing based on patient responses

---

## Troubleshooting

**Q: Messages not sending?**
- Check SMS budget isn't exceeded
- Verify appointment date is in future
- Check server logs for errors

**Q: Cron job not working?**
- Test manually: `curl -X POST http://localhost:5000/api/crons/process-appointment-reminders`
- Verify `X-Cron-Key` matches your `.env` file
- Check server is running

**Q: Data not ingesting?**
- Verify API key is correct
- Check phone numbers are E.164 format: `+254712345678`
- Review API error response

---

## Documentation Files

- **Full Documentation**: `SMS_PATIENT_ENGAGEMENT_GUIDE.md`
- **API Schema**: See structured comments in `server/routes/*.js`
- **Database**: `supabase/migrations/20260223_create_patient_engagement_schema.sql`

---

## Support

For detailed information, see `SMS_PATIENT_ENGAGEMENT_GUIDE.md`

Key sections:
- Complete API documentation
- Cron job setup for all platforms
- Security considerations
- Message variable reference
- Integration examples
