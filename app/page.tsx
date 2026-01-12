'use client';

import VideoPlayer from './components/VideoPlayer';
import SessionControls from './components/SessionControls';
import SessionSummary from './components/SessionSummary';
import { useState, useEffect, useRef } from 'react';
import { BehavioralSignal } from './lib/types';
import { useSession } from './lib/session-context';

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<string>('Not started');
  const [currentSignals, setCurrentSignals] = useState<BehavioralSignal[]>([]);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<{
    signals: BehavioralSignal[];
    startTime: number;
    endTime: number;
  } | null>(null);
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
      setShowSummary(false);
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
        setShowSummary(true);
        // Clear preserved data after using it
        preservedSessionData.current = null;
      }
    }
    
    previousActiveState.current = sessionActive;
  }, [sessionActive, sessionState.startTime, sessionState.signals]);

  const handleCloseSummary = () => {
    setShowSummary(false);
    setSummaryData(null);
  };

  const getStatusColor = () => {
    if (streamStatus.includes('Error')) return 'text-red-500';
    if (streamStatus.includes('active')) return 'text-orange-400';
    if (streamStatus.includes('stopped')) return 'text-gray-400';
    return 'text-orange-500';
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
          <SessionControls />
        </div>

        {/* Status Card */}
        <div className="glass-dark rounded-2xl p-4 md:p-6 mb-6 backdrop-blur-xl border border-white/10 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')} animate-pulse`}></div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                <p className={`text-base md:text-lg font-semibold ${getStatusColor()} transition-colors duration-300`}>
                  {streamStatus}
                </p>
              </div>
            </div>
            {currentSignals.length > 0 && (
              <div className="flex items-center gap-2 animate-scale-in">
                <div className="px-3 py-1.5 bg-orange-500/20 backdrop-blur-sm rounded-full border border-orange-500/30">
                  <span className="text-sm font-medium text-orange-300">
                    {currentSignals.length} signal{currentSignals.length !== 1 ? 's' : ''} active
                  </span>
                </div>
              </div>
            )}
          </div>
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
                  setCurrentSignals([]);
                }}
                onSignalsUpdate={(signals) => {
                  console.log('Signals updated:', signals);
                  setCurrentSignals(signals);
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
              startTime={summaryData?.startTime || sessionState.startTime || Date.now()}
              endTime={summaryData?.endTime || (sessionActive ? Date.now() : Date.now())}
              isLive={sessionActive && !summaryData}
              onClose={summaryData ? handleCloseSummary : undefined}
            />
          </div>
        </div>
      </div>
    </main>
  );
}