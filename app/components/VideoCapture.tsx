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

  /**
   * Stops the video stream and releases camera resources
   */
  const stopStream = useCallback(() => {
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
    onStreamStop?.();
  }, [onStreamStop]);

  /**
   * Starts the video stream by requesting access to the user's webcam
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
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Validate audio tracks are present if audio was requested
      if (constraints.audio) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          const errorMsg = 'Microphone permission denied or no microphone available. Please allow microphone access and try again.';
          setError(errorMsg);
          setIsLoading(false);
          setIsStreaming(false);
          // Stop the stream since audio is required
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          onStreamError?.(new Error(errorMsg));
          return;
        }
      }

      // Set up track end listeners to detect camera disconnection
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          // Check if this stream is still the active one
          if (streamRef.current === stream) {
            setError('Camera disconnected. Please reconnect your camera and try again.');
            setIsStreaming(false);
            setIsLoading(false);
            onStreamError?.(new Error('Camera disconnected'));
            // Clean up the stream reference
            streamRef.current = null;
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
          }
        };
      });

      // Set the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Play the video once metadata is loaded
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.error('Error playing video:', err);
            setError('Failed to play video stream');
            setIsLoading(false);
            setIsStreaming(false);
            onStreamError?.(new Error('Failed to play video stream'));
          });
        };
        
        // Also listen for video element errors (e.g., when stream stops unexpectedly)
        videoRef.current.onerror = () => {
          // Only show error if we have an active stream and no existing error
          if (streamRef.current && streamRef.current === stream) {
            setError('Camera stream error. Please check your camera connection.');
            setIsStreaming(false);
            setIsLoading(false);
            onStreamError?.(new Error('Camera stream error'));
            streamRef.current = null;
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
          }
        };
      }

      setIsStreaming(true);
      setIsLoading(false);
      onStreamReady?.(stream);
    } catch (err) {
      // Log the full error for debugging
      console.error('getUserMedia error:', err);
      
      // Handle DOMException (which getUserMedia throws)
      const error = err as DOMException;
      let errorMessage = 'Failed to access webcam';
      
      // Try to enumerate devices to determine if camera exists
      let hasVideoDevices = false;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        hasVideoDevices = devices.some(device => device.kind === 'videoinput');
      } catch (enumError) {
        // If enumeration fails, we can't determine device availability
      }
      
      // Check error name or message - prioritize NotFoundError for missing cameras
      if (error.name) {
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          // Check if this is about audio or video
          const errorMsgLower = (error.message || '').toLowerCase();
          if (errorMsgLower.includes('microphone') || errorMsgLower.includes('audio')) {
            errorMessage = 'No microphone found. Please connect a microphone and try again.';
          } else {
            errorMessage = 'No camera found. Please connect a camera and try again.';
          }
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          // Check if this is about audio or video
          const errorMsgLower = (error.message || '').toLowerCase();
          if (errorMsgLower.includes('microphone') || errorMsgLower.includes('audio')) {
            errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
          } else if (errorMsgLower.includes('camera') || errorMsgLower.includes('video')) {
            errorMessage = 'Camera permission denied. Please allow camera access and try again.';
          } else {
            errorMessage = 'Camera or microphone permission denied. Please allow access and try again.';
          }
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          // NotReadableError can mean either "in use" or "not found"
          // Check if we have video devices available
          if (!hasVideoDevices) {
            errorMessage = 'No camera found. Please connect a camera and try again.';
          } else {
            // Check error message for keywords that indicate "not found" vs "in use"
            const errorMsgLower = (error.message || '').toLowerCase();
            if (errorMsgLower.includes('not found') || errorMsgLower.includes('no device') || 
                errorMsgLower.includes('device not found') || errorMsgLower.includes('no camera') ||
                errorMsgLower.includes('could not start video source')) {
              // "Could not start video source" often means device not found/plugged in
              errorMessage = 'No camera found. Please connect a camera and try again.';
            } else {
              errorMessage = 'Camera is already in use by another application.';
            }
          }
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not support the requested constraints.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Camera access blocked due to security restrictions.';
        } else {
          // Check error message for keywords that indicate camera not found
          const errorMsgLower = (error.message || '').toLowerCase();
          if (errorMsgLower.includes('not found') || errorMsgLower.includes('no device') || 
              errorMsgLower.includes('device not found') || errorMsgLower.includes('no camera')) {
            errorMessage = 'No camera found. Please connect a camera and try again.';
          } else {
            errorMessage = `Camera error: ${error.name}. ${error.message || ''}`;
          }
        }
      } else if (error.message) {
        // Check error message for keywords
        const errorMsgLower = error.message.toLowerCase();
        if (errorMsgLower.includes('not found') || errorMsgLower.includes('no device') || 
            errorMsgLower.includes('device not found') || errorMsgLower.includes('no camera')) {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else {
          errorMessage = `Camera error: ${error.message}`;
        }
      }

      console.error('Setting error state:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
      setIsStreaming(false);
      onStreamError?.(new Error(errorMessage));
    }
  }, [constraints, onStreamReady, onStreamError, stopStream]);

  // Auto-start stream if autoStart is true (only once)
  useEffect(() => {
    if (autoStart && !isStreaming && !isLoading && !hasAttemptedAutoStart.current) {
      hasAttemptedAutoStart.current = true;
      startStream();
    }
  }, [autoStart, isStreaming, isLoading, startStream]);

  // Cleanup on unmount - use refs to avoid dependency issues
  useEffect(() => {
    return () => {
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
    <div className={`relative w-full h-full ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover rounded-lg shadow-2xl"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg z-20 animate-fade-in">
          <div className="text-white text-center">
            <div className="relative mx-auto mb-4">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-turquoise-500/20"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-turquoise-500 absolute top-0 left-0"></div>
            </div>
            <p className="text-lg font-medium">Accessing camera...</p>
            <p className="text-sm text-gray-400 mt-1">Please allow camera access when prompted</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20 animate-fade-in">
          <div className="text-white text-center p-6 max-w-md">
            <div className="mb-4 text-5xl">⚠️</div>
            <p className="text-red-400 mb-4 text-lg font-medium">{error}</p>
            <button
              onClick={() => {
                setError(null);
                startStream();
              }}
              className="px-6 py-3 bg-turquoise-600 hover:bg-turquoise-700 active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {isStreaming && !isLoading && !error && (
        <div className="absolute top-4 right-4 z-20 animate-scale-in">
          <button
            onClick={() => {
              stopStream();
            }}
            className="px-4 py-2.5 bg-red-600/90 hover:bg-red-700 active:scale-95 backdrop-blur-sm rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 border border-red-500/30 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop Camera
          </button>
        </div>
      )}

      {!isStreaming && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-sm rounded-lg animate-fade-in">
          <div className="flex flex-col items-center justify-center gap-8 text-white text-center px-4">
            <div className="w-20 h-20 rounded-full bg-turquoise-500/20 flex items-center justify-center border-2 border-turquoise-500/30">
              <svg className="w-10 h-10 text-turquoise-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-300 text-lg font-medium">Camera not active</p>
            <button
              onClick={() => {
                startStream();
              }}
              className="px-8 py-3.5 bg-gradient-to-r from-turquoise-600 to-turquoise-700 hover:from-turquoise-700 hover:to-turquoise-800 active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}