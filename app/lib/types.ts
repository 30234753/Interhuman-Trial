/**
 * TypeScript interfaces for behavioral signals, API responses, and session data
 */

export interface BehavioralSignal {
  type: 'stress' | 'engagement' | 'confusion' | 'hesitation' | 'agreement' | 'disagreement' | 'disengagement';
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

export interface SessionData {
  id: string;
  startTime: number;
  endTime?: number;
  signals: BehavioralSignal[];
  averageStressScore?: number;
}

export interface SessionState {
  isActive: boolean;
  sessionId: string | null;
  startTime: number | null;
  signals: BehavioralSignal[];
  currentSignals: BehavioralSignal[];
}

