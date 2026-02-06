-- Allow API (anon key) to insert and select session_category_feedback.
-- If RLS is enabled on this table, inserts were being rejected with no policies.

ALTER TABLE session_category_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to insert session_category_feedback"
  ON session_category_feedback FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to select session_category_feedback"
  ON session_category_feedback FOR SELECT
  TO anon
  USING (true);
