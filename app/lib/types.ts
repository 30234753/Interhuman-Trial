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

export interface SessionData {
  id: string;
  startTime: number;
  endTime?: number;
  signals: BehavioralSignal[];
  averageStressScore?: number;
  transcriptChunks?: TranscriptChunk[];
}

export interface SessionState {
  isActive: boolean;
  sessionId: string | null;
  startTime: number | null;
  signals: BehavioralSignal[];
}

export interface Report {
  id: string;
  name: string;
  session_id: string;
  created_at: string;
}

