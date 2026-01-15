'use client';

import VideoPlayer from './components/VideoPlayer';
import AudioPlayer from './components/AudioPlayer';
import SessionControls from './components/SessionControls';
import SessionSummary from './components/SessionSummary';
import { useState, useEffect, useRef } from 'react';
import { BehavioralSignal } from './lib/types';
import { useSession } from './lib/session-context';

type Mode = 'video+voice' | 'voice-only';

export default function Home() {
  const [mode, setMode] = useState<Mode>('video+voice');
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
        
        {/* Mode Toggle */}
        <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center justify-center gap-4">
            <span className="text-gray-400 text-sm font-medium">Mode:</span>
            <div className="flex gap-2 bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
              <button
                onClick={() => setMode('video+voice')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                  mode === 'video+voice'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Video + Voice
                </span>
              </button>
              <button
                onClick={() => setMode('voice-only')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                  mode === 'voice-only'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Voice Only
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Session Controls */}
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <SessionControls streamStatus={streamStatus} />
        </div>

        {/* Video Player and Session Summary - Side by Side */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {/* Video/Audio Player Container - Main Focus */}
          <div className="w-full">
            <div className="glass-dark rounded-2xl p-4 md:p-6 backdrop-blur-xl border border-white/10 shadow-2xl">
              {mode === 'video+voice' ? (
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
              ) : (
                <AudioPlayer
                  autoStart={false}
                  enabled={true}
                  analysisInterval={2000}
                  onStreamReady={(stream) => {
                    debugLog({location:'page.tsx:189',message:'Audio stream ready callback',data:{hasStream:!!stream,audioTracks:stream?.getAudioTracks().length||0,sessionActive},sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'});
                    console.log('Audio stream ready:', stream);
                    setStreamStatus('Audio streaming active - Analysis enabled');
                  }}
                  onStreamError={(error) => {
                    console.error('Audio stream error:', error);
                    setStreamStatus(`Error: ${error.message}`);
                  }}
                  onStreamStop={() => {
                    console.log('Audio stream stopped');
                    setStreamStatus('Audio stream stopped');
                  }}
                  onSignalsUpdate={(signals) => {
                    debugLog({location:'page.tsx:201',message:'onSignalsUpdate called in voice-only mode',data:{signalsCount:signals?.length||0,signals:signals?.map((s:any)=>({type:s.type,intensity:s.intensity}))||[],sessionActive},sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'});
                    console.log('Signals updated (voice-only):', signals);
                    // Update session with signals if session is active
                    if (sessionActive) {
                      updateSignals(signals);
                    }
                  }}
                  className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-600/50"
                />
              )}
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