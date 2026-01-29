-- Questions table: pop-up questions (MC or open-ended) for trial sessions
-- Schema: id, type, category, text, options (jsonb), correct_answer, created_at, updated_at

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'open_ended')),
  category TEXT NOT NULL CHECK (category IN ('maths', 'casual', 'pub_quiz', 'open_ended')),
  text TEXT NOT NULL,
  options JSONB, -- e.g. [{ "letter": "A", "text": "..." }, ...] for MC; null for open-ended
  correct_answer TEXT, -- e.g. 'A' for MC; null for open-ended
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session answers: one row per question answered in a session (links question to time window + spoken answer)
-- Schema: session_id, question_id, start_time, end_time, spoken_answer, correct

CREATE TABLE IF NOT EXISTS session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  start_time BIGINT NOT NULL, -- milliseconds (answer window start)
  end_time BIGINT NOT NULL,   -- milliseconds (answer window end)
  spoken_answer TEXT NOT NULL DEFAULT '',
  correct BOOLEAN, -- true/false for MC; null for open-ended
  UNIQUE(session_id, question_id) -- one answer per question per session
);

CREATE INDEX IF NOT EXISTS idx_session_answers_session_id ON session_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_session_answers_question_id ON session_answers(question_id);

-- RLS: allow read/write with anon key (same as existing sessions/signals usage)
-- Enable RLS so policies apply; use permissive policies for app access
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_answers ENABLE ROW LEVEL SECURITY;

-- Questions: allow read for all (trial page loads questions)
CREATE POLICY "Allow read questions" ON questions FOR SELECT USING (true);
-- Allow insert/update/delete if you add admin later; for now allow all for seed data
CREATE POLICY "Allow all questions" ON questions FOR ALL USING (true) WITH CHECK (true);

-- Session answers: allow all for session flow (create/read tied to session)
CREATE POLICY "Allow all session_answers" ON session_answers FOR ALL USING (true) WITH CHECK (true);
