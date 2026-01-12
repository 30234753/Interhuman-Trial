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
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
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