'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface VideoCaptureProps {
  onStreamReady?: (stream: MediaStream) => void;
  onStreamError?: (error: Error) => void;
  onStreamStop?: () => void;
  constraints?: MediaStreamConstraints;
  autoStart?: boolean;
  className?: string;
}

/**
 * VideoCapture component that handles webcam access and video stream capture
 * using the getUserMedia API.
 */
export default function VideoCapture({
  onStreamReady,
  onStreamError,
  onStreamStop,
  constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    },
    audio: true,
  },
  autoStart = false,
  className = '',
}: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasAttemptedAutoStart = useRef(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // #region agent log
  const logDebug = (message: string, data: any, hypothesisId?: string) => {
    fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VideoCapture.tsx',
        message,
        data: { ...data, isStreaming, isLoading, error },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: hypothesisId || 'ALL'
      })
    }).catch(() => {});
  };
  // #endregion

  /**
   * Stops the video stream and releases camera resources
   */
  const stopStream = useCallback(() => {
    // #region agent log
    logDebug('stopStream called', { hasStream: !!streamRef.current, currentError: error }, 'A');
    // #endregion
    
    if (streamRef.current) {
      // Stop all tracks in the stream
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Clear the video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    // Don't clear error here - let it persist
    // #region agent log
    logDebug('stopStream calling onStreamStop', {}, 'A');
    // #endregion
    onStreamStop?.();
  }, [onStreamStop]);

  /**
   * Starts the video stream by requesting access to the user's webcam
   */
  const startStream = useCallback(async () => {
    // #region agent log
    logDebug('startStream called', { hasExistingStream: !!streamRef.current, currentState: { isStreaming, isLoading, error } }, 'ALL');
    // #endregion
    
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'getUserMedia is not supported in this browser';
      // #region agent log
      logDebug('getUserMedia not supported', { errorMsg }, 'ALL');
      // #endregion
      setError(errorMsg);
      onStreamError?.(new Error(errorMsg));
      return;
    }

    // Stop existing stream if any
    if (streamRef.current) {
      // #region agent log
      logDebug('Stopping existing stream before starting new one', {}, 'D');
      // #endregion
      stopStream();
    }

    setIsLoading(true);
    setError(null);
    // #region agent log
    logDebug('State set: isLoading=true, error=null', {}, 'B');
    // #endregion

    try {
      // #region agent log
      logDebug('Calling getUserMedia', { constraints }, 'E');
      // #endregion
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // #region agent log
      logDebug('getUserMedia succeeded', { streamId: stream.id, tracks: stream.getTracks().length }, 'E');
      // #endregion
      streamRef.current = stream;

      // Set the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Play the video once metadata is loaded
        videoRef.current.onloadedmetadata = () => {
          // #region agent log
          logDebug('Video metadata loaded, attempting play', {}, 'E');
          // #endregion
          videoRef.current?.play().catch((err) => {
            // #region agent log
            logDebug('Video play failed', { error: err.message, errorName: err.name }, 'E');
            // #endregion
            console.error('Error playing video:', err);
            setError('Failed to play video stream');
            setIsLoading(false);
            setIsStreaming(false);
            onStreamError?.(new Error('Failed to play video stream'));
          });
        };
      }

      setIsStreaming(true);
      setIsLoading(false);
      // #region agent log
      logDebug('State set: isStreaming=true, isLoading=false, calling onStreamReady', {}, 'E');
      // #endregion
      onStreamReady?.(stream);
    } catch (err) {
      // Log the full error for debugging
      console.error('getUserMedia error:', err);
      
      // Handle DOMException (which getUserMedia throws)
      const error = err as DOMException;
      let errorMessage = 'Failed to access webcam';
      
      // #region agent log
      logDebug('getUserMedia error caught', { errorName: error.name, errorMessage: error.message, errorCode: error.code }, 'ALL');
      // #endregion
      
      // Check error name or message
      if (error.name) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Camera is already in use by another application.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not support the requested constraints.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Camera access blocked due to security restrictions.';
        } else {
          errorMessage = `Camera error: ${error.name}. ${error.message || ''}`;
        }
      } else if (error.message) {
        errorMessage = `Camera error: ${error.message}`;
      }

      console.error('Setting error state:', errorMessage);
      // #region agent log
      logDebug('Setting error state before setError', { errorMessage, currentState: { isStreaming, isLoading, error } }, 'B');
      // #endregion
      setError(errorMessage);
      setIsLoading(false);
      setIsStreaming(false);
      // #region agent log
      logDebug('State set: error set, isLoading=false, isStreaming=false, calling onStreamError', { errorMessage }, 'C');
      // #endregion
      onStreamError?.(new Error(errorMessage));
      // #region agent log
      logDebug('After onStreamError callback', { errorMessage }, 'C');
      // #endregion
    }
  }, [constraints, onStreamReady, onStreamError, stopStream]);

  // Auto-start stream if autoStart is true (only once)
  useEffect(() => {
    // #region agent log
    logDebug('Auto-start effect running', { autoStart, isStreaming, isLoading, hasAttempted: hasAttemptedAutoStart.current }, 'ALL');
    // #endregion
    if (autoStart && !isStreaming && !isLoading && !hasAttemptedAutoStart.current) {
      hasAttemptedAutoStart.current = true;
      // #region agent log
      logDebug('Auto-starting stream', {}, 'ALL');
      // #endregion
      startStream();
    }
  }, [autoStart, isStreaming, isLoading, startStream]);

  // Cleanup on unmount - use refs to avoid dependency issues
  useEffect(() => {
    return () => {
      // #region agent log
      logDebug('Cleanup effect: cleaning up stream on unmount', { hasStream: !!streamRef.current }, 'A');
      // #endregion
      // Use refs directly to avoid dependency on stopStream callback
      // This prevents the cleanup from running when stopStream callback changes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []); // Empty deps - only run on actual unmount, not when callbacks change

  // Expose video ref and stream control functions via ref (optional, for parent components)
  useEffect(() => {
    if (videoRef.current) {
      // Store control functions on the video element for external access if needed
      (videoRef.current as any).startStream = startStream;
      (videoRef.current as any).stopStream = stopStream;
      (videoRef.current as any).getStream = () => streamRef.current;
    }
  }, [startStream, stopStream]);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover rounded-lg"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
            <p>Accessing camera...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg z-10">
          <div className="text-white text-center p-4">
            <p className="text-red-400 mb-2">⚠️ {error}</p>
            <button
              onClick={() => {
                setError(null);
                startStream();
              }}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {isStreaming && !isLoading && !error && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => {
              // #region agent log
              logDebug('Stop Camera button clicked', { currentState: { isStreaming, isLoading, error } }, 'ALL');
              // #endregion
              stopStream();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium shadow-lg"
          >
            Stop Camera
          </button>
        </div>
      )}

      {!isStreaming && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
          <div className="text-white text-center">
            <p className="mb-4">Camera not active</p>
            <button
              onClick={() => {
                // #region agent log
                logDebug('Start Camera button clicked', { currentState: { isStreaming, isLoading, error } }, 'ALL');
                // #endregion
                startStream();
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
            >
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to access video capture functionality
 */
export function useVideoCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const startStream = useCallback(async (constraints?: MediaStreamConstraints) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported');
    }
    const stream = await navigator.mediaDevices.getUserMedia(
      constraints || {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      }
    );
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    return stream;
  }, []);

  const stopStream = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  return { videoRef, startStream, stopStream };
}