-- ================================================================
-- MIGRATION: Add sms_activation column to facilities table
-- ================================================================
-- Allows super admins to enable/disable SMS sending per facility.
-- Default is FALSE (off) — facilities must be explicitly activated.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS sms_activation BOOLEAN NOT NULL DEFAULT FALSE;

-- Verify
SELECT id, name, sms_activation FROM facilities ORDER BY name;
