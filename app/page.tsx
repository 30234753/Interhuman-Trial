'use client';

import VideoPlayer from './components/VideoPlayer';
import SessionControls from './components/SessionControls';
import SessionSummary from './components/SessionSummary';
import { useState, useEffect, useRef } from 'react';
import { BehavioralSignal } from './lib/types';
import { useSession } from './lib/session-context';

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<string>('Not started');
  const [summaryData, setSummaryData] = useState<{
    signals: BehavioralSignal[];
    startTime: number;
    endTime: number;
  } | null>(null);
  const [liveEndTime, setLiveEndTime] = useState<number>(Date.now());
  const { updateSignals, isActive: sessionActive, sessionState } = useSession();
  const previousActiveState = useRef<boolean>(false);
  const preservedSessionData = useRef<{ signals: BehavioralSignal[]; startTime: number } | null>(null);

  // Preserve session data before it's cleared
  useEffect(() => {
    if (sessionActive && sessionState.signals.length > 0 && sessionState.startTime) {
      preservedSessionData.current = {
        signals: [...sessionState.signals],
        startTime: sessionState.startTime,
      };
    }
  }, [sessionActive, sessionState.signals, sessionState.startTime]);

  // Track session end and prepare summary data, and reset when new session starts
  useEffect(() => {
    // Detect when session transitions from inactive to active (new session starting)
    if (!previousActiveState.current && sessionActive) {
      // Clear summary data from previous session to allow real-time updates for new session
      setSummaryData(null);
      preservedSessionData.current = null;
    }
    
    // Detect when session transitions from active to inactive (session ending)
    if (previousActiveState.current && !sessionActive) {
      const endTime = Date.now();
      
      // Use preserved data if current state is already cleared
      const signals = sessionState.signals.length > 0 
        ? sessionState.signals 
        : (preservedSessionData.current?.signals || []);
      const startTime = sessionState.startTime || preservedSessionData.current?.startTime;
      
      if (signals.length > 0 && startTime) {
        setSummaryData({
          signals,
          startTime,
          endTime,
        });
        // Clear preserved data after using it
        preservedSessionData.current = null;
      }
    }
    
    previousActiveState.current = sessionActive;
  }, [sessionActive, sessionState.startTime, sessionState.signals]);

  // Update live endTime periodically when session is active (to avoid hydration issues)
  useEffect(() => {
    if (sessionActive && !summaryData) {
      // Update immediately on mount
      setLiveEndTime(Date.now());
      
      // Update every second for live display
      const interval = setInterval(() => {
        setLiveEndTime(Date.now());
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      // Reset when session ends
      setLiveEndTime(Date.now());
    }
  }, [sessionActive, summaryData]);

  const handleCloseSummary = () => {
    setSummaryData(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 max-w-6xl w-full items-center justify-between animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up pt-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-normal pb-2 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent px-4">
            Roleplay Body Language Analyser
          </h1>
          <p className="text-gray-400 text-sm md:text-base mt-2">
            Real-time behavioural analysis powered by AI
          </p>
        </div>
        
        {/* Session Controls */}
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <SessionControls streamStatus={streamStatus} />
        </div>

        {/* Video Player and Session Summary - Side by Side */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {/* Video Player Container - Main Focus */}
          <div className="w-full">
            <div className="glass-dark rounded-2xl p-4 md:p-6 backdrop-blur-xl border border-white/10 shadow-2xl">
              <VideoPlayer
                autoStart={false}
                enabled={true}
                analysisInterval={2000}
                onStreamReady={(stream) => {
                  console.log('Stream ready:', stream);
                  setStreamStatus('Streaming active - Analysis enabled');
                }}
                onStreamError={(error) => {
                  console.error('Stream error:', error);
                  setStreamStatus(`Error: ${error.message}`);
                }}
                onStreamStop={() => {
                  console.log('Stream stopped');
                  setStreamStatus('Stream stopped');
                }}
                onSignalsUpdate={(signals) => {
                  console.log('Signals updated:', signals);
                  // Update session with signals if session is active
                  if (sessionActive) {
                    updateSignals(signals);
                  }
                }}
                className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-600/50"
              />
            </div>
          </div>

          {/* Session Summary - Sidebar, Always visible */}
          <div className="w-full">
            <SessionSummary
              signals={summaryData?.signals || (sessionActive ? sessionState.signals : [])}
              startTime={summaryData?.startTime || sessionState.startTime || null}
              endTime={summaryData?.endTime || (sessionActive ? liveEndTime : Date.now())}
              isLive={sessionActive && !summaryData}
              onClose={summaryData ? handleCloseSummary : undefined}
            />
          </div>
        </div>
      </div>
    </main>
  );
}