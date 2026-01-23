'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/app/lib/session-context';

export interface SessionControlsProps {
  onSessionStart?: (sessionId: string) => void;
  onSessionStop?: () => void;
  className?: string;
  streamStatus?: string;
}

/**
 * SessionControls component that provides start/stop buttons and session management
 */
export default function SessionControls({
  onSessionStart,
  onSessionStop,
  className = '',
  streamStatus = 'Not started',
}: SessionControlsProps) {
  const { sessionState, startSession, stopSession } = useSession();
  const [duration, setDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Update duration timer when session is active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (sessionState.isActive && sessionState.startTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - sessionState.startTime!;
        setDuration(Math.floor(elapsed / 1000)); // Duration in seconds
      }, 1000);
    } else {
      setDuration(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [sessionState.isActive, sessionState.startTime]);

  /**
   * Formats duration in seconds to MM:SS format
   */
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Handles session start
   */
  const handleStartSession = useCallback(async () => {
    if (sessionState.isActive) {
      return;
    }

    setIsLoading(true);
    try {
      const sessionId = await startSession();
      if (sessionId) {
        onSessionStart?.(sessionId);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionState.isActive, startSession, onSessionStart]);

  /**
   * Handles session stop
   */
  const handleStopSession = useCallback(async () => {
    if (!sessionState.isActive) {
      return;
    }

    setIsLoading(true);
    try {
      await stopSession();
      onSessionStop?.();
    } catch (error) {
      console.error('Error stopping session:', error);
      alert('Failed to stop session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionState.isActive, stopSession, onSessionStop]);

  const getStatusColor = () => {
    if (streamStatus.includes('Error')) return 'text-red-500';
    if (streamStatus.includes('active')) return 'text-realtalk-blue';
    if (streamStatus.includes('stopped')) return 'text-gray-400';
    return 'text-realtalk-blue';
  };

  return (
    <div className={`glass-dark rounded-2xl p-4 md:p-6 backdrop-blur-xl border border-gray-200 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Session Status and Stream Status */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                sessionState.isActive ? 'bg-realtalk-blue animate-pulse' : 'bg-gray-400'
              }`}
            ></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Session</p>
              <p className={`text-base md:text-lg font-semibold ${
                sessionState.isActive ? 'text-realtalk-blue' : 'text-gray-500'
              }`}>
                {sessionState.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
          
          {/* Stream Status */}
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')} animate-pulse`}></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
              <p className={`text-base md:text-lg font-semibold ${getStatusColor()} transition-colors duration-300`}>
                {streamStatus}
              </p>
            </div>
          </div>
          
          {sessionState.isActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-realtalk-blue/10 backdrop-blur-sm rounded-full border border-realtalk-blue/20">
              <svg className="w-4 h-4 text-realtalk-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-realtalk-blue">
                {formatDuration(duration)}
              </span>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-3">
          {!sessionState.isActive ? (
            <button
              onClick={handleStartSession}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-realtalk-dark to-realtalk-blue hover:from-realtalk-blue hover:to-realtalk-light active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
              style={{
                backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0)',
                color: '#ffffff',
              }}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Start Session</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleStopSession}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                  <span>Stopping...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  <span>Stop Session</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Session Info */}
      {sessionState.isActive && sessionState.sessionId && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider">Session ID:</span>
              <span className="font-mono text-realtalk-blue">{sessionState.sessionId}</span>
            </div>
            {sessionState.signals.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider">Signals:</span>
                <span className="text-realtalk-blue font-semibold">{sessionState.signals.length}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

