/**
 * TypeScript interfaces for behavioral signals, API responses, and session data
 */

export interface BehavioralSignal {
  type: 'agreement' | 'confidence' | 'confusion' | 'disagreement' | 'disengagement' | 'engagement' | 'frustration' | 'hesitation' | 'interest' | 'skepticism' | 'stress' | 'uncertainty';
  intensity: number; // 0-100 scale
  timestamp: number;
}

export interface InterhumanAPIResponse {
  signals: BehavioralSignal[];
  metadata?: {
    frameId?: string;
    timestamp?: number;
  };
}

export interface TranscriptChunk {
  text: string;
  chunkOrder: number;
  timestamp: number; // Unix timestamp in milliseconds
}

/** Question type for pop-up questions (MC or open-ended) */
export type QuestionType = 'multiple_choice' | 'open_ended';

/** Question category for grouping */
export type QuestionCategory = 'maths' | 'casual' | 'pub_quiz' | 'open_ended' | 'science' | 'reasoning' | 'sports';

export interface QuestionOption {
  letter: string;
  text: string;
}

/** Question stored in Supabase (questions table) */
export interface Question {
  id: string;
  type: QuestionType;
  category: QuestionCategory;
  text: string;
  options: QuestionOption[] | null; // MC only; null for open-ended
  correct_answer: string | null; // e.g. 'A' for MC; null for open-ended
  created_at?: string;
  updated_at?: string;
}

/** Session answer with question snapshot for report display */
export interface SessionAnswer {
  questionId: string;
  questionText: string;
  type: QuestionType;
  options: QuestionOption[] | null;
  correctAnswer: string | null;
  startTime: number;
  endTime: number;
  spokenAnswer: string;
  correct: boolean | null; // MC only; null for open-ended
}

export interface SessionData {
  id: string;
  startTime: number;
  endTime?: number;
  signals: BehavioralSignal[];
  averageStressScore?: number;
  transcriptChunks?: TranscriptChunk[];
  answers?: SessionAnswer[];
}

export interface SessionState {
  isActive: boolean;
  sessionId: string | null;
  startTime: number | null;
  signals: BehavioralSignal[];
}

export interface Report {
  id: string;
  session_id: string;
  created_at: string;
  rating?: number | null;
  feedback?: string | null;
}