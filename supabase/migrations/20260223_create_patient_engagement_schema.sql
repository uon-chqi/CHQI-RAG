/*
  # Patient Engagement System Schema

  Adds support for:
  1. Facility registration and tracking
  2. Patient risk classification (HIGH, MEDIUM, LOW)
  3. Appointment management
  4. SMS configuration (one-way automated messages)
  5. SMS/WhatsApp budget limits (two-way messaging)
  6. Message templates for automated messaging
*/

-- Facilities table (registered facilities that send data)
CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id text NOT NULL UNIQUE, -- External facility identifier
  facility_name text NOT NULL,
  location text,
  contact_email text,
  contact_phone text,
  api_key text, -- Hashed API key for authentication
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage facilities"
  ON facilities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage facilities"
  ON facilities FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_facilities_facility_id ON facilities(facility_id);
CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(status);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  facility_id text NOT NULL, -- ID from external facility system
  patient_name text,
  email text,
  risk_level text NOT NULL DEFAULT 'MEDIUM' CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage patients"
  ON patients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage patients"
  ON patients FOR ALL
  USING (true)
  WITH CHECK (true);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id text NOT NULL,
  appointment_date timestamptz NOT NULL,
  appointment_type text, -- checkup, followup, procedure, etc.
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(patient_id, appointment_date) -- Prevent duplicate appointments
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage appointments"
  ON appointments FOR ALL
  USING (true)
  WITH CHECK (true);

-- SMS Configuration (One-way automated messages)
-- This table stores the timing for automated appointment reminders
CREATE TABLE IF NOT EXISTS sms_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  -- days_before_appointment or specific timing rules
  message_timing jsonb NOT NULL, -- Array of timing objects
  -- Example: [
  --   { "days_before_appointment": 30, "time": "09:00", "enabled": true },
  --   { "days_before_appointment": 21, "time": "09:00", "enabled": true },
  --   { "days_before_appointment": 14, "time": "09:00", "enabled": true },
  --   { "days_before_appointment": 7, "time": "09:00", "enabled": true },
  --   { "days_before_appointment": 3, "time": "09:00", "enabled": true },
  --   { "days_before_appointment": 1, "time": "09:00", "enabled": true }
  -- ]
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(facility_id, risk_level)
);

ALTER TABLE sms_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage SMS configurations"
  ON sms_configurations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can read SMS configurations"
  ON sms_configurations FOR SELECT
  USING (true);

-- SMS/WhatsApp Budget Limits (Two-way messaging)
-- This table stores message budgets for two-way conversations
CREATE TABLE IF NOT EXISTS sms_budget_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  messages_per_month integer NOT NULL DEFAULT 100,
  messages_per_patient_per_month integer, -- Optional: per-patient limit
  budget_month_start_day integer DEFAULT 1, -- Day of month budget resets
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(facility_id, risk_level)
);

ALTER TABLE sms_budget_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage SMS budget limits"
  ON sms_budget_limits FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can read SMS budget limits"
  ON sms_budget_limits FOR SELECT
  USING (true);

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id text NOT NULL,
  template_type text NOT NULL, -- appointment_reminder, appointment_confirmation, missed_appointment, etc.
  risk_level text, -- NULL means applies to all risk levels
  subject text,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb, -- Array of variable names: ["patient_name", "appointment_date", "clinic_name"]
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage message templates"
  ON message_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can read message templates"
  ON message_templates FOR SELECT
  USING (true);

-- Track sent SMS messages (for audit and budget tracking)
CREATE TABLE IF NOT EXISTS sms_sent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  facility_id text NOT NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  message_type text NOT NULL, -- automated_reminder, two_way_conversation, etc.
  phone_number text NOT NULL,
  message_body text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending', 'delivered')),
  external_message_id text, -- ID from SMS provider
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sms_sent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SMS history"
  ON sms_sent_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert SMS records"
  ON sms_sent_messages FOR INSERT
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone_number);
CREATE INDEX IF NOT EXISTS idx_patients_facility ON patients(facility_id);
CREATE INDEX IF NOT EXISTS idx_patients_risk_level ON patients(risk_level);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_facility ON appointments(facility_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE INDEX IF NOT EXISTS idx_sms_config_facility ON sms_configurations(facility_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_sms_budget_facility ON sms_budget_limits(facility_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_message_templates_facility ON message_templates(facility_id, template_type);
CREATE INDEX IF NOT EXISTS idx_sms_sent_patient ON sms_sent_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_sms_sent_appointment ON sms_sent_messages(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sms_sent_created ON sms_sent_messages(created_at DESC);
