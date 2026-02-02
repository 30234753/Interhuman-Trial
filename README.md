# Roleplay Body Language Analyzer

A Next.js web application that analyzes body language during roleplay sessions using Interhuman AI's API, providing real-time feedback and stress scoring.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Interhuman AI API credentials
   - Add your Deepgram API key for live transcription

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

- `INTERHUMAN_API_KEY_ID`: Your Interhuman AI API key ID
- `INTERHUMAN_API_KEY_SECRET`: Your Interhuman AI API key secret
- `INTERHUMAN_API_URL`: Interhuman AI API endpoint URL (default: https://api.interhuman.ai)
- `DEEPGRAM_API_KEY`: Your Deepgram API key for live transcription

## Project Structure

- `app/`: Next.js app directory with pages and API routes
- `app/components/`: React components for video capture, feedback overlay, etc.
- `app/lib/`: Utility functions and API clients
- `app/api/`: API routes for analysis and session management

### Questions API

- **GET /api/questions** – Returns questions from Supabase for trial pop-ups.
  - Query params (optional): `category` (e.g. `maths`, `pub_quiz`, `open_ended`), `ids` (comma-separated UUIDs).
  - No params: returns all questions. Response: array of `Question` objects.
  - Ensure questions are seeded (see **Seeding questions** below) so the trial page has data.

## Database schema (Supabase)

Migrations live in `supabase/migrations/`. Apply them via Supabase CLI or run the SQL in the Supabase SQL editor.

### Tables

- **sessions** – Session lifecycle (start_time, end_time).
- **signals** – Behavioral signals per session (session_id, type, intensity, timestamp).
- **transcript_chunks** – Transcript chunks per session (session_id, text, chunk_order, timestamp).
- **questions** – Pop-up questions for trial sessions:
  - `id` (uuid), `type` (`'multiple_choice' | 'open_ended'`), `category` (`'maths' | 'casual' | 'pub_quiz' | 'open_ended' | 'science' | 'reasoning' | 'sports'`), `text` (text), `options` (jsonb, e.g. `[{ "letter": "A", "text": "..." }]` for MC; null for open-ended), `correct_answer` (text, e.g. `'A'` for MC; null for open-ended), `created_at`, `updated_at`.
- **session_answers** – One row per question answered in a session:
  - `session_id` (fk → sessions), `question_id` (fk → questions), `start_time`, `end_time` (bigint, ms), `spoken_answer` (text), `correct` (boolean for MC; null for open-ended).

### RLS

- **questions**: RLS enabled; policies allow read and full CRUD (for seeding and future admin).
- **session_answers**: RLS enabled; policies allow full CRUD for session flow.

**Seeding questions:** The seed includes 60 questions (10 maths, 10 sports, 10 pub_quiz, 10 science, 10 reasoning, 10 open-ended). Run the migrations `20250129100000_add_question_categories_science_reasoning.sql` and `20250129200000_add_question_category_sports.sql` first (adds `science`, `reasoning`, and `sports`). Then use `supabase/seed_questions.csv` to import via Table Editor → **questions** → Import → CSV, or run `supabase/seed_questions.sql` in the SQL Editor.

### Testing the data model

1. **Apply the migration**  
   In the [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor, run the contents of `supabase/migrations/20250129000000_add_questions_and_session_answers.sql` (or use Supabase CLI: `supabase db push`).

2. **Check that tables exist**  
   In Supabase Dashboard → Table Editor, verify that the tables (`sessions`, `signals`, `transcript_chunks`, `questions`, `session_answers`) exist.

3. **Test session data with answers (optional)**  
   - In Supabase: insert one row into `questions` (e.g. type `multiple_choice`, category `maths`, text `What is 2+2?`, options `[{"letter":"A","text":"3"},{"letter":"B","text":"4"}]`, correct_answer `B`).  
   - Create or pick a session (e.g. from `sessions`), note its `id`.  
   - Insert one row into `session_answers`: that `session_id`, the question’s `id`, `start_time`/`end_time` (e.g. two timestamps in ms), `spoken_answer` (e.g. `B`), `correct` (e.g. `true`).  
   - Call `GET /api/session?sessionId=<that session id>`.  
   - In the response, `sessionData.answers` should be an array with one item (question text, spoken answer, correct, etc.).

### Testing pop-up questions (trial flow)

1. **Prerequisites**  
   - Dev server running: `npm run dev`  
   - Questions seeded in Supabase (see **Seeding questions** above).  
   - Environment variables set (Interhuman, Deepgram, Supabase) in `.env.local`.

2. **Run a trial**  
   - Open [http://localhost:3000/trial](http://localhost:3000/trial).  
   - Accept the consent modal if shown.  
   - Click **Start session**.  
   - The first question pop-up appears (MC first, then open-ended).  
   - Allow camera and microphone when prompted.

3. **Answer questions**  
   - **Multiple choice (A, B, C)**: Say “A”, “B”, or “C” (or “one”, “two”, “three”) — the pop-up auto-advances when it detects an option. Or type/click **Done** to submit the current transcript.  
   - **Open-ended**: Speak your answer, then click **Done**.  
   - Each question has a 20s countdown; after timeout the current transcript is submitted.

4. **After the last question**  
   - The session ends and you are redirected to the timeline report for that session.  
   - On the timeline, each question appears with its spoken answer and the signals captured during that answer window.