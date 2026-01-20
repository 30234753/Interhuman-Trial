-- Supabase Database Migration Script
-- Run this script in your Supabase SQL Editor to create the required tables
-- for session data, signals, and transcript chunks

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create signals table
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  intensity INTEGER NOT NULL CHECK (intensity >= 0 AND intensity <= 100),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create transcript_chunks table
CREATE TABLE IF NOT EXISTS transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  chunk_order INTEGER NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for signals table
CREATE INDEX IF NOT EXISTS idx_signals_session_id ON signals(session_id);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);

-- Create indexes for transcript_chunks table
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_session_id ON transcript_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_session_order ON transcript_chunks(session_id, chunk_order);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_timestamp ON transcript_chunks(timestamp);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on sessions table
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) - adjust policies as needed for your use case
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your security requirements)
-- These policies allow anonymous access - modify if you need authentication
-- Drop existing policies if they exist (for re-running the migration)
DROP POLICY IF EXISTS "Allow all operations on sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all operations on signals" ON signals;
DROP POLICY IF EXISTS "Allow all operations on transcript_chunks" ON transcript_chunks;

CREATE POLICY "Allow all operations on sessions" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on signals" ON signals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on transcript_chunks" ON transcript_chunks
  FOR ALL USING (true) WITH CHECK (true);
