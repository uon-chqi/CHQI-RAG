# SMS Patient Engagement System - Architecture Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PATIENT ENGAGEMENT PLATFORM                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      FACILITY SYSTEMS                            │
├─────────────────────────────────────────────────────────────────┤
│  Patient Database  │  Appointment System  │  EHR System         │
└────────┬───────────┴──────────┬───────────┴──────────┬──────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                        ┌───────▼────────┐
                        │  Cron Job      │
                        │  (Daily/Hourly)│
                        └────────┬────────┘
                                 │
                    ┌────────────▼───────────────┐
                    │  API DATA INGESTION        │
                    ├────────────────────────────┤
                    │ /api/facilities/patients   │
                    │ /api/facilities/appointments
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼───────────────┐
                    │    PostgreSQL Database     │
                    ├────────────────────────────┤
                    │ • patients (with risk)     │
                    │ • appointments             │
                    │ • sms_configurations       │
                    │ • sms_budget_limits        │
                    │ • message_templates        │
                    │ • sms_sent_messages        │
                    └────────┬──────────┬────────┘
                             │          │
        ┌────────────────────┘          └─────────────────┐
        │                                                 │
        │ ┌──────────────────────────────────────────┐  │
        │ │  ADMIN DASHBOARD                         │  │
        │ ├──────────────────────────────────────────┤  │
        │ │ 1. SMS Configuration Page                │  │
        │ │    - Configure reminder timing           │  │
        │ │    - Set SMS budgets                     │  │
        │ │    - Manage templates                    │  │
        │ │                                          │  │
        │ │ 2. Patient Management Page               │  │
        │ │    - View patients                       │  │
        │ │    - Filter by risk level                │  │
        │ │    - Monitor statistics                  │  │
        │ └──────────────────────────────────────────┘  │
        │                                                 │
        │ /api/sms-admin/*                              │
        └─────────────────────┬──────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  CRON JOB SCHEDULER│
                    ├────────────────────┤
                    │ /api/crons/        │
                    │ process-appointment│
                    │ -reminders         │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────────────┐
                    │  SMS SCHEDULER SERVICE     │
                    ├────────────────────────────┤
                    │ smsScheduler.js:           │
                    │ • Find appointments        │
                    │ • Check risk level config  │
                    │ • Check budget             │
                    │ • Get message template     │
                    │ • Send SMS                 │
                    │ • Log to audit table       │
                    └─────────┬──────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
              ┌────▼─────┐           ┌──▼─────────┐
              │ Twilio   │           │ WhatsApp   │
              │ SMS API  │           │ API        │
              └──────────┘           └────────────┘
                   │                     │
              ┌────▼─────────────────────▼────┐
              │  PATIENT SMS/WHATSAPP DEVICES  │
              └────────────────────────────────┘
```

---

## Data Flow: One-Way Automated Reminders

```
STEP 1: PATIENT Created in System
┌─────────────────────────────────┐
│ Facility posts patient data      │
│ POST /api/facilities/patients    │
├─────────────────────────────────┤
│ {                               │
│   patient_id: "EXT-123"         │
│   phone_number: "+254712345678" │
│   risk_level: "HIGH"            │
│ }                               │
└────────────────┬────────────────┘
                 │
        ┌────────▼────────┐
        │ Stored in DB:   │
        │ patients table  │
        │ risk_level=HIGH │
        └────────┬────────┘

STEP 2: APPOINTMENT Created
┌─────────────────────────────────┐
│ Facility posts appointment       │
│ POST /api/facilities/appointments│
├─────────────────────────────────┤
│ {                               │
│   appointment_id: "APT-456"     │
│   patient_id: "EXT-123"         │
│   appointment_date: "2026-03-22"│  (29 days away)
│ }                               │
└────────────────┬────────────────┘
                 │
        ┌────────▼──────────┐
        │ Stored in DB:     │
        │ appointments table│
        └────────┬──────────┘

STEP 3: CRON JOB Runs (Every Hour)
┌──────────────────────────────────┐
│ Cron triggers:                   │
│ /api/crons/process-appointment   │
│ -reminders                       │
└────────────────┬─────────────────┘
                 │
        ┌────────▼───────────────────────┐
        │ smsScheduler.processAppointments│
        │                                │
        │ 1. Find appointments within    │
        │    30 days from now            │
        │    ✓ Found: APT-456            │
        │                                │
        │ 2. Get patient & config        │
        │    Patient: risk_level = HIGH  │
        │    Config: 6 message timings   │
        │                                │
        │ 3. Check today's timing        │
        │    Appointment: March 22        │
        │    Days until: 29              │
        │    Today's message? YES        │
        │    (Match: 30 days)            │
        │                                │
        │ 4. Check if already sent       │
        │    Query: sms_sent_messages    │
        │    Result: None found          │
        │                                │
        │ 5. Check SMS budget            │
        │    Facility budget: 1000/month │
        │    Already sent: 245           │
        │    Available: 755 ✓            │
        │                                │
        │ 6. Get message template        │
        │    Template body:              │
        │    "Hi {{patient_name}},      │
        │    your appointment is on      │
        │    {{appointment_date}}..."    │
        │                                │
        │ 7. Format message              │
        │    Final: "Hi John Doe,       │
        │    your appointment is on      │
        │    March 22, 2026..."          │
        └────────┬──────────────────────┘
                 │
        ┌────────▼──────────┐
        │ Send via SMS API  │
        │ (Twilio/etc)      │
        │ To: +254712345678 │
        │ Status: sent ✓    │
        └────────┬──────────┘
                 │
        ┌────────▼──────────────────┐
        │ Log to audit table:        │
        │ sms_sent_messages          │
        ├────────────────────────────┤
        │ patient_id: uuid           │
        │ appointment_id: uuid       │
        │ message_type: "reminder"   │
        │ status: "sent"             │
        │ created_at: now()          │
        └────────────────────────────┘

STEP 4: CRON JOB Runs 7 Days Later
┌──────────────────────────────────┐
│ 7 days until appointment          │
│ Cron timer matches config         │
│ Second message sent               │
│ Process repeats...                │
└──────────────────────────────────┘

STEP 5: APPOINTMENT DAY ARRIVES
┌──────────────────────────────────┐
│ Patient has received 6 messages   │
│ May still receive reminders if    │
│ configured for day-of             │
│ Appointment occurs                │
│ Status updated to "completed"     │
└──────────────────────────────────┘
```

---

## Configuration Flow: Admin Dashboard

```
ADMIN OPENS DASHBOARD
    │
    ▼
┌─────────────────────────────────────┐
│ SMSConfiguration Page               │
├─────────────────────────────────────┤
│ Facility ID: clinic-001             │
│                                     │
│ [Appointment Reminders] [Budget] ...│
└─────────────────────┬───────────────┘
                      │
┌─────────────────────▼────────────────┐
│ View HIGH Risk Configuration         │
├────────────────────────────────────┤
│ Risk Level: HIGH                    │
│                                     │
│ Message Timing:                     │
│ ☑ 30 days before @ 09:00            │
│ ☑ 21 days before @ 09:00            │
│ ☑ 14 days before @ 09:00            │
│ ☑ 7 days before @ 09:00             │
│ ☑ 3 days before @ 09:00             │
│ ☑ 1 day before @ 09:00              │
│                                     │
│ [Add Timing] [Edit] [Save Changes]  │
└─────────────────────┬────────────────┘
                      │
                   ADMIN MAKES CHANGE
                      │
                      ├─ Adds 4 week timing
                      ├─ Disables 3 day timing
                      └─ Changes 1 day to 6 AM
                      │
┌─────────────────────▼────────────────┐
│ ADMIN CLICKS [SAVE CHANGES]          │
└─────────────────────┬────────────────┘
                      │
         ┌────────────▼──────────────┐
         │ POST /api/sms-admin/      │
         │ configurations            │
         │                           │
         │ Payload:                  │
         │ {                         │
         │   facility_id: clinic-001 │
         │   risk_level: "HIGH"      │
         │   message_timing: [       │
         │     {28, 09:00, enabled},  │
         │     {21, 09:00, enabled},  │
         │     {14, 09:00, enabled},  │
         │     {7, 09:00, enabled},   │
         │     {3, 09:00, disabled},  │
         │     {1, 06:00, enabled}    │
         │   ]                       │
         │ }                         │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │ Update DB:                │
         │ sms_configurations        │
         │ WHERE facility_id &       │
         │ risk_level match          │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │ Response: 200 OK          │
         │ Configuration saved!      │
         └────────────┬──────────────┘
                      │
                      ▼
         ✓ CHANGES TAKE EFFECT
           IMMEDIATELY FOR
           NEW APPOINTMENTS
```

---

## Budget Enforcement Flow

```
APPOINTMENT WANTS TO SEND MESSAGE
    │
    ├─ Patient: HIGH risk
    ├─ Facility: clinic-001
    └─ Current month: February 2026
    
    ▼
┌─────────────────────────────────────┐
│ CHECK BUDGET LIMITS                 │
├─────────────────────────────────────┤
│                                     │
│ 1. Get budget config:               │
│    messages_per_month: 1000         │
│    budget_month_start_day: 1        │
│                                     │
│ 2. Calculate month start:           │
│    Feb 1, 2026                      │
│                                     │
│ 3. Count messages sent this month:  │
│    SELECT COUNT(*) FROM             │
│    sms_sent_messages WHERE          │
│    facility_id='clinic-001' AND     │
│    created_at >= Feb 1              │
│    Result: 856 messages             │
│                                     │
│ 4. Calculate available:             │
│    Budget: 1000                     │
│    Used: 856                        │
│    Available: 144 ✓                 │
│                                     │
└────────┬─────────────────────────────┘
         │
         ├─ IF budget available: SEND MESSAGE
         │
         └─ IF budget exhausted: SKIP AND LOG
```

---

## Two-Way SMS Flow (From Conversations)

```
PATIENT SENDS SMS
    │
    ▼
┌─────────────────────────────────┐
│ Webhook from SMS Provider       │
│ (Twilio, MessageBird, etc)      │
├─────────────────────────────────┤
│ {                               │
│   from: "+254712345678"         │
│   body: "Yes, confirmed"        │
│ }                               │
└─────────┬───────────────────────┘
          │
          ▼
   ┌──────────────────┐
   │ Find patient record
   │ by phone number   │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────────┐
   │ CHECK 2-WAY BUDGET    │
   ├──────────────────────┤
   │ Messages this month:│
   │ 847                │
   │ Budget limit: 1000 │
   │ Available: 153 ✓   │
   └────────┬────────────┘
            │
            ▼
   ┌──────────────────────┐
   │ Log to conversations │
   │ table                │
   │                      │
   │ Process via RAG      │
   │ (existing system)    │
   └──────────────────────┘
```

---

## Risk Level Classification

```
PATIENT INGESTED FROM FACILITY SYSTEM
    │
    ├─ Assigned risk_level: HIGH, MEDIUM, or LOW
    │
    ▼
┌──────────────────────────────────────────┐
│          RISK LEVEL IMPLICATIONS         │
├──────────────────────────────────────────┤
│                                          │
│  HIGH RISK PATIENT                       │
│  ├─ More frequent appointment reminders │
│  │  └─ 6 messages sent (30,21,14,7,3,1 d)
│  ├─ Higher SMS budget                    │
│  │  └─ 1000 messages/month               │
│  ├─ May need closer monitoring           │
│  └─ Gets more support via 2-way SMS     │
│     └─ 100 msgs/patient/month            │
│                                          │
│  MEDIUM RISK PATIENT                     │
│  ├─ Standard reminders                   │
│  │  └─ 3 messages sent (14,7,1 days)    │
│  ├─ Moderate SMS budget                  │
│  │  └─ 500 messages/month                │
│  └─ Standard engagement via 2-way SMS   │
│     └─ 50 msgs/patient/month             │
│                                          │
│  LOW RISK PATIENT                        │
│  ├─ Minimal reminders                    │
│  │  └─ 2 messages sent (14,1 days)      │
│  ├─ Lower SMS budget                     │
│  │  └─ 200 messages/month                │
│  └─ Limited engagement via 2-way SMS    │
│     └─ 20 msgs/patient/month             │
│                                          │
└──────────────────────────────────────────┘
```

---

## Integration Points for Your Facility

```
YOUR FACILITY SYSTEM
    │
    ├─ Patient Database
    │  └─ Sync daily/hourly
    │     POST /api/facilities/patients
    │
    ├─ Appointment System
    │  └─ Sync daily/hourly
    │     POST /api/facilities/appointments
    │
    └─ Admin Interface
       └─ View SMS configuration
          Dashboard: /sms-configuration
          
       └─ View patient data
          Dashboard: /patient-management


WHAT YOU NEED TO BUILD:
1. Cron job that runs daily/hourly
2. Query your patient + appointment databases
3. Transform to our JSON format
4. POST to /api/facilities/* endpoints
5. Include X-Facility-API-Key header


EXAMPLE CRON JOB (Node.js):
┌──────────────────────────────────┐
│ const patients = await           │
│   db.patients.find({             │
│     status: 'active'             │
│   });                            │
│                                  │
│ const result = await fetch(      │
│   '/api/facilities/patients',    │
│   {                              │
│     method: 'POST',              │
│     headers: {                   │
│       'X-Facility-API-Key': key  │
│     },                           │
│     body: JSON.stringify({       │
│       patients: patients         │
│     })                           │
│   }                              │
│ );                               │
└──────────────────────────────────┘
```

---

## Message Template System

```
TEMPLATE CREATION
    │
    ▼
┌───────────────────────────────────────┐
│ Admin creates template:               │
│ template_type: "appointment_reminder" │
│ body: "Hi {{patient_name}},          │
│        your appointment is on         │
│        {{appointment_date}}..."       │
│ variables: ["patient_name",           │
│             "appointment_date"]       │
└───────────────┬───────────────────────┘
                │
WHEN MESSAGE NEEDS TO SEND
                │
                ▼
        ┌──────────────────┐
        │ Get template     │
        │ from database    │
        └────────┬─────────┘
                │
                ▼
        ┌──────────────────────────┐
        │ Format template:         │
        │                          │
        │ Variables:               │
        │ {                        │
        │   patient_name: "John"   │
        │   appointment_date: "22" │
        │   appointment_time: "2PM"│
        │ }                        │
        │                          │
        │ Replace {{var}} → value  │
        └────────┬─────────────────┘
                │
                ▼
        ┌─────────────────────┐
        │ Final Message:      │
        │ "Hi John,          │
        │  your appointment  │
        │  is on March 22..."│
        │                    │
        │ Send to patient    │
        └────────────────────┘
```

---

## Audit & Compliance Tracking

```
EVERY SMS MESSAGE CREATES AUDIT RECORD
    │
    ▼
┌──────────────────────────────────────┐
│  sms_sent_messages table             │
├──────────────────────────────────────┤
│  id: UUID                            │
│  patient_id: UUID                    │
│  patient_phone: TEXT                 │
│  message_type: "reminder|twoway"     │
│  message_body: TEXT (full message)   │
│  channel: "sms|whatsapp"             │
│  status: "sent|failed|pending"       │
│  external_message_id: TEXT           │
│  sent_at: TIMESTAMP                  │
│                                      │
│  This allows you to:                 │
│  ✓ Track what was sent               │
│  ✓ When it was sent                  │
│  ✓ To whom it was sent               │
│  ✓ Via which channel                 │
│  ✓ Delivery status                   │
│  ✓ Audit compliance                  │
│  ✓ Troubleshoot failures             │
│                                      │
└──────────────────────────────────────┘
```

---

## Cron Job Processing Timeline

```
TIME        ACTION
────        ──────────────────────────────

12:00 AM    Facility system exports patient/appointment data
            └─ 150 patients updated
            └─ 200 appointments added

02:00 AM    Facility cron job runs
            └─ POST /api/facilities/patients
            └─ POST /api/facilities/appointments
            └─ Data ingested into PostgreSQL

06:00 AM    SMS Reminder Cron Job triggers
            └─ Process appointments within 30 days
            └─ Check which messages should send today
            └─ 42 messages sent
            └─ Logged to sms_sent_messages

09:00 AM    Admin reviews SMS log
            └─ View delivery status
            └─ Monitor budget usage
            └─ Adjust configuration if needed

12:00 PM    SMS Reminder Cron Job triggers
            └─ Check for new appointments
            └─ Process any messages due today
            └─ 15 messages sent

03:00 PM    SMS Reminder Cron Job triggers
            └─ Continue processing
            └─ 8 messages sent
            └─ Total for day: 65 messages

...         Repeat hourly or as configured
```

---

This architecture ensures:
- ✅ Scalable message processing
- ✅ Budget control per risk level
- ✅ Compliance tracking via audit logs
- ✅ Easy configuration without coding
- ✅ Integration with any facility system
- ✅ Two-way SMS/WhatsApp support
- ✅ Risk-based personalization
