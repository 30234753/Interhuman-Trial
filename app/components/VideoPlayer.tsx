'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import VideoCapture, { VideoCaptureProps } from './VideoCapture';
import FeedbackOverlay from './FeedbackOverlay';
import { BehavioralSignal } from '@/app/lib/types';
import { SignalAggregator } from '@/app/lib/signal-aggregator';

export interface VideoPlayerProps extends Omit<VideoCaptureProps, 'onStreamReady'> {
  onStreamReady?: (stream: MediaStream) => void;
  onSignalsUpdate?: (signals: BehavioralSignal[]) => void;
  analysisInterval?: number; // Interval in milliseconds between frame captures
  enabled?: boolean; // Whether to enable real-time analysis
}

/**
 * Video display component with overlay canvas for feedback indicators
 * Combines VideoCapture with FeedbackOverlay for real-time behavioral signal display
 */
export default function VideoPlayer({
  onStreamReady,
  onSignalsUpdate,
  analysisInterval = 2000, // Default: analyze every 2 seconds
  enabled = true,
  className = '',
  ...videoCaptureProps
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentSignals, setCurrentSignals] = useState<BehavioralSignal[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamActiveRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Signal aggregator for tracking signals over time window (15 seconds)
  const signalAggregator = useMemo(() => {
    return new SignalAggregator({ windowMs: 15000 });
  }, []);

  /**
   * Gets the video element from the VideoCapture component
   */
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    if (!containerRef.current) return null;
    return containerRef.current.querySelector('video') as HTMLVideoElement | null;
  }, []);

  /**
   * Captures a frame from the video stream and sends it for analysis
   */
  const captureAndAnalyze = useCallback(async () => {
    // Check if stream is still active before starting analysis
    if (!isStreamActiveRef.current) {
      return;
    }

    const video = getVideoElement();
    if (!video || !enabled || isAnalyzing) {
      return;
    }
    
    // Check if video is ready and playing
    if (video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    // Double-check stream is still active after async checks
    if (!isStreamActiveRef.current) {
      return;
    }

    setIsAnalyzing(true);

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Create a canvas to capture the current frame
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Draw the current video frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to base64
      const base64Data = canvas.toDataURL('image/jpeg', 0.8);

      // Check again if stream is still active before making request
      if (!isStreamActiveRef.current) {
        return;
      }

      // Send frame for analysis with abort signal
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoData: base64Data,
          format: 'base64',
          metadata: {
            timestamp: Date.now(),
          },
        }),
        signal: abortController.signal,
      });

      // Check if stream is still active after fetch completes
      if (!isStreamActiveRef.current) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Analysis failed:', errorData);
        return;
      }

      const data = await response.json();
      
      // Final check before updating signals
      if (!isStreamActiveRef.current) {
        return;
      }
      
      // Update signals if we got valid data and stream is still active
      if (data.signals && Array.isArray(data.signals)) {
        const currentTime = Date.now();
        const baseSignals: BehavioralSignal[] = data.signals.map((signal: any) => ({
          type: signal.type,
          intensity: signal.intensity || 0, // Base intensity from API
          timestamp: signal.timestamp || currentTime,
        }));

        // Add signals to aggregator for history tracking
        signalAggregator.addSignals(baseSignals, currentTime);

        // Calculate duration-based intensities using persistence metrics
        const enhancedSignals: BehavioralSignal[] = baseSignals.map((signal) => {
          const baseIntensity = signal.intensity;
          const calculatedIntensity = signalAggregator.calculateIntensity(
            signal.type,
            baseIntensity,
            currentTime
          );

          return {
            ...signal,
            intensity: calculatedIntensity,
          };
        });

        setCurrentSignals(enhancedSignals);
        onSignalsUpdate?.(enhancedSignals);
      }
    } catch (error) {
      // Ignore abort errors (expected when stream stops)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error during frame analysis:', error);
    } finally {
      // Only clear analyzing state if stream is still active
      if (isStreamActiveRef.current) {
        setIsAnalyzing(false);
      }
      abortControllerRef.current = null;
    }
  }, [enabled, isAnalyzing, onSignalsUpdate, getVideoElement]);

  /**
   * Handles stream ready event and starts analysis loop
   */
  const handleStreamReady = useCallback((stream: MediaStream) => {
    // Mark stream as active
    isStreamActiveRef.current = true;

    // Start periodic analysis if enabled
    if (enabled && analysisInterval > 0) {
      // Clear any existing interval
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }

      // Start new analysis interval
      analysisIntervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, analysisInterval);
    }

    onStreamReady?.(stream);
  }, [enabled, analysisInterval, captureAndAnalyze, onStreamReady]);

  /**
   * Handles stream stop and cleans up analysis interval
   */
  const handleStreamStop = useCallback(() => {
    // Mark stream as inactive
    isStreamActiveRef.current = false;

    // Clear analysis interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    // Abort any in-flight analysis requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear analyzing state
    setIsAnalyzing(false);

    // Clear signal aggregator history
    signalAggregator.clear();

    // Clear current signals immediately
    setCurrentSignals([]);
    onSignalsUpdate?.([]);

    videoCaptureProps.onStreamStop?.();
  }, [videoCaptureProps, onSignalsUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, []);

  // Update analysis when enabled state changes
  useEffect(() => {
    if (!enabled && analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    } else if (enabled && analysisInterval > 0) {
      const video = getVideoElement();
      if (video?.srcObject) {
        // Restart analysis if enabled and video is ready
        if (analysisIntervalRef.current) {
          clearInterval(analysisIntervalRef.current);
        }
        analysisIntervalRef.current = setInterval(() => {
          captureAndAnalyze();
        }, analysisInterval);
      }
    }
  }, [enabled, analysisInterval, captureAndAnalyze, getVideoElement]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video capture component */}
      <VideoCapture
        {...videoCaptureProps}
        onStreamReady={handleStreamReady}
        onStreamStop={handleStreamStop}
        className="absolute inset-0 z-10"
      />

      {/* Feedback overlay */}
      <FeedbackOverlay
        signals={currentSignals}
        showLabels={true}
        showValues={true}
        compact={false}
      />

      {/* Analysis status indicator */}
      {isAnalyzing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 glass-dark px-4 py-2 rounded-full border border-blue-500/30 animate-scale-in shadow-lg" style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400/30"></div>
              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-blue-400 absolute top-0 left-0"></div>
            </div>
            <span className="text-white text-xs font-semibold tracking-wide">Analyzing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

