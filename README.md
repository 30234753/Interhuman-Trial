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

