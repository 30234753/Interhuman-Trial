-- Add separate positives and negatives feedback fields to sessions

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS positives TEXT,
  ADD COLUMN IF NOT EXISTS negatives TEXT;

COMMENT ON COLUMN sessions.positives IS 'Free-text: main positives of the experience';
COMMENT ON COLUMN sessions.negatives IS 'Free-text: main negatives of the experience';
