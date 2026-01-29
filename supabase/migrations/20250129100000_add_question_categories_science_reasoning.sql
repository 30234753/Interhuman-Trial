-- Add 'science' and 'reasoning' to allowed question categories
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_category_check;
ALTER TABLE questions ADD CONSTRAINT questions_category_check
  CHECK (category IN ('maths', 'casual', 'pub_quiz', 'open_ended', 'science', 'reasoning'));
