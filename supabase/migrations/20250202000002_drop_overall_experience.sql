-- Remove unused overall_experience column (replaced by positives + negatives)

ALTER TABLE sessions DROP COLUMN IF EXISTS overall_experience;
