-- Store category feedback from the "signals accurate / missed signals" popup after each 5-question block.
-- Run in Supabase SQL Editor or via Supabase CLI.

CREATE TABLE IF NOT EXISTS session_category_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  category text NOT NULL,
  accurate text NOT NULL CHECK (accurate IN ('yes', 'partial', 'no')),
  missed_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE session_category_feedback IS 'User feedback per category block: were detected signals accurate, and which signals may have been missed';
COMMENT ON COLUMN session_category_feedback.session_id IS 'Session this feedback belongs to';
COMMENT ON COLUMN session_category_feedback.category IS 'Question category for this block (e.g. maths, pub_quiz)';
COMMENT ON COLUMN session_category_feedback.accurate IS 'User rating: yes, partial, or no';
COMMENT ON COLUMN session_category_feedback.missed_signals IS 'Array of signal type strings the user thought were present but not detected';

CREATE INDEX IF NOT EXISTS idx_session_category_feedback_session_id ON session_category_feedback(session_id);
