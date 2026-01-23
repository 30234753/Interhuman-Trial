-- Migration: Add rating and feedback to sessions table, drop reports table
-- Run this script in your Supabase SQL Editor

-- Add rating and feedback columns to sessions table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'rating') THEN
    ALTER TABLE sessions ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'feedback') THEN
    ALTER TABLE sessions ADD COLUMN feedback TEXT;
  END IF;
END $$;

-- Drop reports table if it exists
DROP TABLE IF EXISTS reports CASCADE;
