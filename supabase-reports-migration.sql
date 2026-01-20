-- Supabase Database Migration Script for Reports Table
-- Run this script in your Supabase SQL Editor to create the reports table
-- for saving timeline reports

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index on session_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_reports_session_id ON reports(session_id);

-- Create index on created_at for ordered listing
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security requirements)
-- Drop existing policy if it exists (for re-running the migration)
DROP POLICY IF EXISTS "Allow all operations on reports" ON reports;

CREATE POLICY "Allow all operations on reports" ON reports
  FOR ALL USING (true) WITH CHECK (true);
