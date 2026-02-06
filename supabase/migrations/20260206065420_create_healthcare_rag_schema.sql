/*
  # Healthcare RAG System Database Schema

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `title` (text) - Document title
      - `file_name` (text) - Original file name
      - `file_path` (text) - Storage path
      - `file_type` (text) - PDF, DOCX, etc.
      - `total_chunks` (integer) - Number of chunks created
      - `status` (text) - processing, completed, error
      - `metadata` (jsonb) - Additional metadata
      - `uploaded_by` (uuid) - Admin user ID
      - `uploaded_at` (timestamptz)
      - `processed_at` (timestamptz)

    - `conversations`
      - `id` (uuid, primary key)
      - `patient_phone` (text) - Masked phone number
      - `channel` (text) - sms or whatsapp
      - `message` (text) - User message
      - `response` (text) - AI response
      - `citations` (jsonb) - Source document references
      - `response_time_ms` (integer) - Processing time
      - `status` (text) - sent, error, pending
      - `error_message` (text) - If error occurred
      - `session_id` (text) - Session tracking
      - `created_at` (timestamptz)

    - `sessions`
      - `id` (uuid, primary key)
      - `patient_phone` (text)
      - `channel` (text)
      - `message_count` (integer)
      - `last_message_at` (timestamptz)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)

    - `analytics_daily`
      - `id` (uuid, primary key)
      - `date` (date)
      - `total_messages` (integer)
      - `sms_count` (integer)
      - `whatsapp_count` (integer)
      - `avg_response_time` (integer)
      - `error_count` (integer)
      - `unique_users` (integer)
      - `top_topics` (jsonb)

    - `system_health`
      - `id` (uuid, primary key)
      - `service_name` (text) - gemini, sms, whatsapp, vector_db
      - `status` (text) - healthy, degraded, down
      - `last_check` (timestamptz)
      - `error_message` (text)
      - `response_time_ms` (integer)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated admin access
*/

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  total_chunks integer DEFAULT 0,
  status text DEFAULT 'processing',
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage documents"
  ON documents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  message text NOT NULL,
  response text,
  citations jsonb DEFAULT '[]'::jsonb,
  response_time_ms integer,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error')),
  error_message text,
  session_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone text NOT NULL,
  channel text NOT NULL,
  message_count integer DEFAULT 0,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 minutes'
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Analytics daily table
CREATE TABLE IF NOT EXISTS analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  total_messages integer DEFAULT 0,
  sms_count integer DEFAULT 0,
  whatsapp_count integer DEFAULT 0,
  avg_response_time integer DEFAULT 0,
  error_count integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  top_topics jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analytics"
  ON analytics_daily FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can update analytics"
  ON analytics_daily FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL UNIQUE,
  status text DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  last_check timestamptz DEFAULT now(),
  error_message text,
  response_time_ms integer
);

ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system health"
  ON system_health FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can update health"
  ON system_health FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(patient_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_daily(date DESC);

-- Insert initial system health records
INSERT INTO system_health (service_name, status) VALUES
  ('gemini', 'unknown'),
  ('vector_db', 'unknown'),
  ('sms', 'unknown'),
  ('whatsapp', 'unknown')
ON CONFLICT (service_name) DO NOTHING;