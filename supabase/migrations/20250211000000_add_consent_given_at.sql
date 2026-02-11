-- Record consent timestamp on the session for audit/compliance.
-- When the user accepts the consent modal (trial), we create the session with consent_given_at set.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;

COMMENT ON COLUMN sessions.consent_given_at IS 'When the user accepted the trial consent modal; used to confirm consent for the session.';
