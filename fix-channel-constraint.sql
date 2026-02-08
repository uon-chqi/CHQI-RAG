-- Fix conversations table channel constraint to allow 'api' for testing

-- Drop old constraint
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_channel_check;

-- Add new constraint allowing 'api', 'sms', 'whatsapp'
ALTER TABLE conversations ADD CONSTRAINT conversations_channel_check 
  CHECK (channel IN ('sms', 'whatsapp', 'api'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'conversations'::regclass AND conname = 'conversations_channel_check';
