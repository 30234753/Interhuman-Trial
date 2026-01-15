'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

export interface AudioCaptureProps {
  onStreamReady?: (stream: MediaStream) => void;
  onStreamError?: (error: Error) => void;
  onStreamStop?: () => void;
  autoStart?: boolean;
  className?: string;
}

/**
 * AudioCapture component that handles microphone access only
 * Similar to VideoCapture but only requests audio
 */
export default function AudioCapture({
  onStreamReady,
  onStreamError,
  onStreamStop,
  autoStart = false,
  className = '',
}: AudioCaptureProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const hasAttemptedAutoStart = useRef(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Stops the audio stream and releases microphone resources
   */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      // Stop all tracks in the stream
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    setIsStreaming(false);
    onStreamStop?.();
  }, [onStreamStop]);

  /**
   * Starts the audio stream by requesting access to the user's microphone
   */
  const startStream = useCallback(async () => {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'getUserMedia is not supported in this browser';
      setError(errorMsg);
      onStreamError?.(new Error(errorMsg));
      return;
    }

    // Stop existing stream if any
    if (streamRef.current) {
      stopStream();
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request only audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;

      // Validate audio tracks are present
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        const errorMsg = 'Microphone permission denied or no microphone available. Please allow microphone access and try again.';
        setError(errorMsg);
        setIsLoading(false);
        setIsStreaming(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        onStreamError?.(new Error(errorMsg));
        return;
      }

      // Set up track end listeners to detect microphone disconnection
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          console.log('Audio track ended');
          stopStream();
        };
      });

      setIsStreaming(true);
      setIsLoading(false);
      onStreamReady?.(stream);
    } catch (error: any) {
      setIsLoading(false);
      setIsStreaming(false);
      let errorMessage = 'Failed to access microphone';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support the requested constraints.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Microphone access blocked due to security restrictions.';
      } else {
        errorMessage = error.message || 'Unknown error accessing microphone';
      }

      setError(errorMessage);
      onStreamError?.(new Error(errorMessage));
    }
  }, [onStreamReady, onStreamError, stopStream]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !hasAttemptedAutoStart.current && !isStreaming && !isLoading) {
      hasAttemptedAutoStart.current = true;
      startStream();
    }
  }, [autoStart, isStreaming, isLoading, startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Audio-only UI */}
      {isStreaming ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center justify-center gap-6 text-white text-center px-4">
            <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center border-2 border-orange-500/30 animate-pulse">
              <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <p className="text-white text-lg font-semibold mb-1">Microphone Active</p>
              <p className="text-gray-400 text-sm">Listening for speech...</p>
            </div>
            <button
              onClick={stopStream}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop Microphone
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-sm rounded-lg animate-fade-in">
          <div className="flex flex-col items-center justify-center gap-8 text-white text-center px-4">
            <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center border-2 border-orange-500/30">
              <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="text-gray-300 text-lg font-medium">Microphone not active</p>
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm max-w-md">
                {error}
              </div>
            )}
            <button
              onClick={startStream}
              disabled={isLoading}
              className="px-8 py-3.5 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start Microphone
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

