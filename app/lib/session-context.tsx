'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, startTransition, ReactNode } from 'react';
import { SessionState, BehavioralSignal } from './types';

interface SessionContextType {
  sessionState: SessionState;
  startSession: () => Promise<string | null>;
  stopSession: () => Promise<void>;
  updateSignals: (signals: BehavioralSignal[]) => void;
  addTranscriptChunk: (text: string, chunkOrder: number, timestamp: number) => Promise<void>;
  isActive: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: false,
    sessionId: null,
    startTime: null,
    signals: [],
  });

  // Refs so updateSignals always sees current session state (avoids stale closure on slow devices)
  const sessionActiveRef = useRef(sessionState.isActive);
  const sessionIdRef = useRef<string | null>(sessionState.sessionId);
  useEffect(() => {
    sessionActiveRef.current = sessionState.isActive;
    sessionIdRef.current = sessionState.sessionId;
  }, [sessionState.isActive, sessionState.sessionId]);

  const startSession = useCallback(async () => {
    if (sessionState.isActive) {
      return null;
    }

    try {
      // Use session created at consent time (trial flow) if present
      if (typeof window !== 'undefined') {
        const preCreated = sessionStorage.getItem('inhuman-trial-pre-created-session');
        if (preCreated) {
          sessionStorage.removeItem('inhuman-trial-pre-created-session');
          const startTime = Date.now();
          setSessionState({
            isActive: true,
            sessionId: preCreated,
            startTime,
            signals: [],
          });
          return preCreated;
        }
      }

      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      const newSessionId = data.sessionId || `session-${Date.now()}`;
      const startTime = Date.now();

      setSessionState({
        isActive: true,
        sessionId: newSessionId,
        startTime,
        signals: [],
      });

      return newSessionId;
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  }, [sessionState.isActive]);

  const stopSession = useCallback(async () => {
    if (!sessionState.isActive || !sessionState.sessionId) {
      return;
    }

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'end',
          sessionId: sessionState.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      // Capture signals and startTime before clearing state (needed for summary)
      const finalSignals = [...sessionState.signals];
      const finalStartTime = sessionState.startTime;

      // Update session with final signals before clearing
      if (finalSignals.length > 0) {
        await fetch('/api/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update',
            sessionId: sessionState.sessionId,
            signals: finalSignals,
          }),
        });
      }

      setSessionState({
        isActive: false,
        sessionId: null,
        startTime: null,
        signals: [],
      });
    } catch (error) {
      console.error('Error stopping session:', error);
      throw error;
    }
  }, [sessionState]);

  const updateSignals = useCallback((signals: BehavioralSignal[]) => {
    // Use refs so we always see current session state (avoids stale closure on slow devices)
    if (!sessionActiveRef.current || !sessionIdRef.current) {
      return;
    }
    const sessionId = sessionIdRef.current;

    // Update session on server asynchronously BEFORE state update to prevent duplicates
    fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        sessionId,
        signals: signals,
      }),
    }).catch((error) => {
      // Silently handle errors - session updates are non-critical
      // The client-side state is the source of truth
      console.debug('Session signals API update failed:', error);
    });

    // Use startTransition so the summary can re-render without blocking the main thread on busy devices
    startTransition(() => {
      setSessionState((prev) => {
        const updatedSignals = [...prev.signals, ...signals];
        return {
          ...prev,
          signals: updatedSignals,
        };
      });
    });
  }, []);

  const addTranscriptChunk = useCallback(async (text: string, chunkOrder: number, timestamp: number) => {
    if (!sessionState.isActive || !sessionState.sessionId) {
      return;
    }

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addTranscriptChunk',
          sessionId: sessionState.sessionId,
          text,
          chunkOrder,
          timestamp,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save transcript chunk');
      }
    } catch (error) {
      // Silently handle errors - chunk saves are non-critical for UI
      // Errors can occur during hot reloads when server state is lost
      console.error('Error saving transcript chunk:', error);
    }
  }, [sessionState.isActive, sessionState.sessionId]);

  return (
    <SessionContext.Provider
      value={{
        sessionState,
        startSession,
        stopSession,
        updateSignals,
        addTranscriptChunk,
        isActive: sessionState.isActive,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

