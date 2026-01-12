'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import VideoCapture, { VideoCaptureProps } from './VideoCapture';
import FeedbackOverlay from './FeedbackOverlay';
import { BehavioralSignal } from '@/app/lib/types';

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
    const video = getVideoElement();
    if (!video || !enabled || isAnalyzing) {
      return;
    }
    
    // Check if video is ready and playing
    if (video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    setIsAnalyzing(true);

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

      // Send frame for analysis
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
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Analysis failed:', errorData);
        return;
      }

      const data = await response.json();
      
      // Update signals if we got valid data
      if (data.signals && Array.isArray(data.signals)) {
        const signals: BehavioralSignal[] = data.signals.map((signal: any) => ({
          type: signal.type,
          intensity: signal.intensity || 0,
          timestamp: signal.timestamp || Date.now(),
        }));

        setCurrentSignals(signals);
        onSignalsUpdate?.(signals);
      }
    } catch (error) {
      console.error('Error during frame analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [enabled, isAnalyzing, onSignalsUpdate, getVideoElement]);

  /**
   * Handles stream ready event and starts analysis loop
   */
  const handleStreamReady = useCallback((stream: MediaStream) => {
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
    // Clear analysis interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    // Clear current signals
    setCurrentSignals([]);

    videoCaptureProps.onStreamStop?.();
  }, [videoCaptureProps]);

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
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video capture component */}
      <VideoCapture
        {...videoCaptureProps}
        onStreamReady={handleStreamReady}
        onStreamStop={handleStreamStop}
        className="relative z-10"
      />

      {/* Feedback overlay */}
      <FeedbackOverlay
        signals={currentSignals}
        showLabels={false}
        showValues={false}
        compact={true}
      />

      {/* Analysis status indicator */}
      {isAnalyzing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-blue-600 bg-opacity-80 px-3 py-1 rounded-full">
          <span className="text-white text-xs font-medium">Analyzing...</span>
        </div>
      )}
    </div>
  );
}

