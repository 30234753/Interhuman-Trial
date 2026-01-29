'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

export interface TranscriptContextType {
  /** Accumulated final transcript (all final phrases so far). */
  finalTranscript: string;
  /** Current interim (in-progress) transcript from the recognizer. */
  interimTranscript: string;
  /** Append a new final phrase. Called by Subtitles when Deepgram finalizes a phrase. */
  appendFinalChunk: (text: string) => void;
  /** Set interim transcript. Called by Subtitles on interim results. */
  setInterimTranscript: (text: string) => void;
  /** Subscribe to each new final chunk (e.g. for MC parsing). Returns unsubscribe. */
  subscribeToFinalChunk: (callback: (text: string) => void) => () => void;
  /** Clear final and interim transcript (e.g. when starting a new answer window). */
  clearTranscript: () => void;
}

const TranscriptContext = createContext<TranscriptContextType | undefined>(
  undefined
);

export function TranscriptProvider({ children }: { children: ReactNode }) {
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscriptState] =
    useState<string>('');
  const subscribersRef = useRef<Set<(text: string) => void>>(new Set());

  const appendFinalChunk = useCallback((text: string) => {
    setFinalTranscript((prev) =>
      prev ? `${prev} ${text}`.trim() : text.trim()
    );
    subscribersRef.current.forEach((cb) => {
      try {
        cb(text);
      } catch (e) {
        console.error('[TranscriptContext] subscriber error:', e);
      }
    });
  }, []);

  const setInterimTranscript = useCallback((text: string) => {
    setInterimTranscriptState(text);
  }, []);

  const subscribeToFinalChunk = useCallback(
    (callback: (text: string) => void) => {
      subscribersRef.current.add(callback);
      return () => {
        subscribersRef.current.delete(callback);
      };
    },
    []
  );

  const clearTranscript = useCallback(() => {
    setFinalTranscript('');
    setInterimTranscriptState('');
  }, []);

  return (
    <TranscriptContext.Provider
      value={{
        finalTranscript,
        interimTranscript,
        appendFinalChunk,
        setInterimTranscript,
        subscribeToFinalChunk,
        clearTranscript,
      }}
    >
      {children}
    </TranscriptContext.Provider>
  );
}

export function useTranscript() {
  const context = useContext(TranscriptContext);
  if (context === undefined) {
    throw new Error('useTranscript must be used within a TranscriptProvider');
  }
  return context;
}
