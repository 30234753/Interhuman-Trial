-- Add feedback fields: use cases (multiple choice + other) and concerns
-- Run in Supabase SQL Editor or via Supabase CLI.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS use_cases jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS use_cases_other text,
  ADD COLUMN IF NOT EXISTS concerns text;

COMMENT ON COLUMN sessions.use_cases IS 'Array of selected use case keys, e.g. ["ai_avatars", "police_interrogations", "other"]';
COMMENT ON COLUMN sessions.use_cases_other IS 'Free text when "other" use case is selected';
COMMENT ON COLUMN sessions.concerns IS 'User feedback: what concerns they have about the application';
