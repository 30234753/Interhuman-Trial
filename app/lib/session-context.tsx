'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'session-context.tsx:115',message:'updateSignals called',data:{newSignalsCount:signals.length,newSignals:signals.map(s=>({type:s.type,intensity:s.intensity,timestamp:s.timestamp})),isActive:sessionState.isActive,sessionId:sessionState.sessionId,currentStateSignalsCount:sessionState.signals.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!sessionState.isActive || !sessionState.sessionId) {
      return;
    }

    // Update session on server asynchronously BEFORE state update to prevent duplicates
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'session-context.tsx:124',message:'Sending signals to API (before state update)',data:{signalsToSendCount:signals.length,signalsToSend:signals.map(s=>({type:s.type,intensity:s.intensity,timestamp:s.timestamp})),sessionId:sessionState.sessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        sessionId: sessionState.sessionId,
        signals: signals,
      }),
    }).catch((error) => {
      // Silently handle errors - session updates are non-critical
      // The client-side state is the source of truth
      // Errors can occur during hot reloads when server state is lost
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'session-context.tsx:134',message:'API update error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    });

    setSessionState((prev) => {
      const updatedSignals = [...prev.signals, ...signals];
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'session-context.tsx:121',message:'State update - signals merged',data:{prevSignalsCount:prev.signals.length,newSignalsCount:signals.length,updatedSignalsCount:updatedSignals.length,newSignals:signals.map(s=>({type:s.type,timestamp:s.timestamp})),prevSignalsLast3:prev.signals.slice(-3).map(s=>({type:s.type,timestamp:s.timestamp}))},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      return {
        ...prev,
        signals: updatedSignals,
      };
    });
  }, [sessionState.isActive, sessionState.sessionId]);

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

