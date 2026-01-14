'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SessionState, BehavioralSignal } from './types';

interface SessionContextType {
  sessionState: SessionState;
  startSession: () => Promise<string | null>;
  stopSession: () => Promise<void>;
  updateSignals: (signals: BehavioralSignal[]) => void;
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

  const startSession = useCallback(async () => {
    if (sessionState.isActive) {
      return;
    }

    try {
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
    if (!sessionState.isActive || !sessionState.sessionId) {
      return;
    }

    setSessionState((prev) => {
      const updatedSignals = [...prev.signals, ...signals];
      
      // Update session on server asynchronously
      fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          sessionId: prev.sessionId,
          signals: signals,
        }),
      }).catch((error) => {
        // Silently handle errors - session updates are non-critical
        // The client-side state is the source of truth
        // Errors can occur during hot reloads when server state is lost
      });

      return {
        ...prev,
        signals: updatedSignals,
      };
    });
  }, [sessionState.isActive, sessionState.sessionId]);

  return (
    <SessionContext.Provider
      value={{
        sessionState,
        startSession,
        stopSession,
        updateSignals,
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

