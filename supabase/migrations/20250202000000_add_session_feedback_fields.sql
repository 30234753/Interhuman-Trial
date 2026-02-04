-- Add overall experience (positives/negatives) and adaptation effectiveness rating to sessions

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS overall_experience TEXT,
  ADD COLUMN IF NOT EXISTS adaptation_rating INTEGER CHECK (adaptation_rating IS NULL OR (adaptation_rating >= 1 AND adaptation_rating <= 5));

COMMENT ON COLUMN sessions.overall_experience IS 'Free-text feedback: overall positives and negatives of the experience';
COMMENT ON COLUMN sessions.adaptation_rating IS '1-5 rating: how effective the system was at adapting questions to signals';
