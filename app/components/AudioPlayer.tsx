'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import AudioCapture from './AudioCapture';
import Subtitles from './Subtitles';
import { BehavioralSignal } from '@/app/lib/types';
import { SignalAggregator } from '@/app/lib/signal-aggregator';

export interface AudioPlayerProps {
  onStreamReady?: (stream: MediaStream) => void;
  onStreamError?: (error: Error) => void;
  onStreamStop?: () => void;
  onSignalsUpdate?: (signals: BehavioralSignal[]) => void;
  autoStart?: boolean;
  enabled?: boolean;
  analysisInterval?: number; // Interval in milliseconds between audio captures
  className?: string;
}

/**
 * Audio-only player component for voice-only mode
 * Displays subtitles from speech recognition
 */
export default function AudioPlayer({
  onStreamReady,
  onStreamError,
  onStreamStop,
  onSignalsUpdate,
  autoStart = false,
  enabled = true,
  analysisInterval = 2000, // Default: analyze every 2 seconds
  className = '',
}: AudioPlayerProps) {
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [currentSignals, setCurrentSignals] = useState<BehavioralSignal[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isStreamActiveRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null); // Store stream in ref for immediate access
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // Canvas for creating video track
  const canvasStreamRef = useRef<MediaStream | null>(null); // Canvas stream reference
  const canvasUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null); // Canvas update interval
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Signal aggregator for tracking signals over time window (15 seconds)
  const signalAggregator = useMemo(() => {
    return new SignalAggregator({ windowMs: 15000 });
  }, []);

  /**
   * Detects the best supported MIME type for audio recording
   * Note: Interhuman AI API expects video files even for audio-only content,
   * so we use video/webm format with audio codecs
   */
  const getSupportedMimeType = useCallback((): string | null => {
    if (typeof MediaRecorder === 'undefined' || !window.MediaRecorder) {
      return null;
    }

    // Preferred video MIME types with both video and audio codecs (matching VideoPlayer)
    // The API expects video format, and we're providing both video (canvas) and audio tracks
    const preferredTypes = [
      // WebM with video codec + audio codec (best quality, matches VideoPlayer)
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,vorbis', // Alternative audio codec
      'video/webm;codecs=vp9,vorbis',
      // WebM with audio codec only (fallback if video codec not supported)
      'video/webm;codecs=opus',
      'video/webm;codecs=vorbis',
      'video/webm', // Generic video/webm (browser will choose codec)
      // MP4 formats
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC (matches VideoPlayer)
      'video/mp4;codecs=mp4a.40.2', // MP4 with AAC audio codec
      'video/mp4', // Generic MP4
      // OGG formats
      'video/ogg;codecs=theora,vorbis', // OGG with video + audio
      'video/ogg;codecs=vorbis', // OGG with vorbis audio
      'video/ogg', // Generic OGG
      // Fallback to audio formats if video formats aren't supported (unlikely)
      'audio/webm;codecs=opus',
      'audio/webm',
    ];

    // Test each type in priority order
    for (const type of preferredTypes) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          console.log(`Using MediaRecorder MIME type: ${type}`);
          return type;
        }
      } catch (error) {
        console.debug(`MediaRecorder.isTypeSupported failed for ${type}:`, error);
      }
    }

    // If no specific type is supported, try to get default type
    try {
      const defaultRecorder = new MediaRecorder(new MediaStream());
      if (defaultRecorder.mimeType) {
        console.warn(`No preferred codec found, using browser default: ${defaultRecorder.mimeType}`);
        return defaultRecorder.mimeType;
      }
    } catch (error) {
      // Can't create MediaRecorder without a stream, that's expected
    }

    console.error('No supported MediaRecorder MIME type found');
    return null;
  }, []);

  /**
   * Records an audio segment from the stream and sends it for analysis
   */
  const captureAndAnalyze = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:89',message:'captureAndAnalyze called',data:{isStreamActive:isStreamActiveRef.current,enabled,isAnalyzing},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Check if stream is still active before starting analysis
    if (!isStreamActiveRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:92',message:'Early return: stream not active',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return;
    }

    // Use stream from ref instead of state to avoid stale closure issues
    const audioStream = streamRef.current;
    if (!audioStream || !enabled || isAnalyzing) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:98',message:'Early return: stream/enabled/isAnalyzing check',data:{hasStream:!!audioStream,enabled,isAnalyzing},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return;
    }

    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined' || !window.MediaRecorder) {
      console.error('MediaRecorder is not supported in this browser.');
      return;
    }

    // Create a canvas with black frame to provide video track for the API
    // The API requires video frames even for audio-only analysis
    // Reuse canvas and stream across calls to maintain stability
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }
    
    // Reuse existing canvas stream if available, otherwise create new one
    let canvasStream = canvasStreamRef.current;
    let videoTrack: MediaStreamTrack | null = null;
    
    if (canvasStream && canvasStream.active) {
      // Reuse existing stream
      videoTrack = canvasStream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === 'ended') {
        // Track ended, need to recreate
        canvasStream = null;
        videoTrack = null;
      }
    }
    
    if (!canvasStream || !videoTrack) {
      // Create new canvas stream
      // Fill canvas with black first
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Create video track from canvas
      canvasStream = canvas.captureStream(30); // 30 FPS
      canvasStreamRef.current = canvasStream; // Store for cleanup
      videoTrack = canvasStream.getVideoTracks()[0];
      
      if (!videoTrack) {
        console.error('Failed to get video track from canvas');
        return;
      }
      
      // Start canvas update interval if not already running
      if (!canvasUpdateIntervalRef.current) {
        const canvasUpdateInterval = setInterval(() => {
          if (ctx && canvas) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // #region agent log
            if (videoTrack) {
              fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:185',message:'Canvas updated',data:{videoTrackReadyState:videoTrack.readyState,videoTrackEnabled:videoTrack.enabled,canvasStreamActive:canvasStream?.active},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H5'})}).catch(()=>{});
            }
            // #endregion
          }
        }, 100); // Update every 100ms to keep stream active
        canvasUpdateIntervalRef.current = canvasUpdateInterval;
      }
    }
    
    // Ensure video track is enabled and active
    if (videoTrack.readyState === 'ended') {
      console.error('Video track is already ended');
      return;
    }
    
    // Combine audio track from microphone with video track from canvas
    const combinedStream = new MediaStream();
    combinedStream.addTrack(videoTrack);
    audioStream.getAudioTracks().forEach(track => {
      combinedStream.addTrack(track);
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:155',message:'Combined stream created',data:{audioTracks:combinedStream.getAudioTracks().length,videoTracks:combinedStream.getVideoTracks().length,canvasWidth:canvas.width,canvasHeight:canvas.height,hasVideoTrack:!!videoTrack},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    const stream = combinedStream;
    if (!stream || !stream.active) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:110',message:'Early return: no stream or stream inactive',data:{hasStream:!!stream,streamActive:stream?.active},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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
      // Detect supported MIME type with fallback logic
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error('No supported audio MIME type found');
      }

      // Record duration: 3-5 seconds (longer duration may help API detect signals from audio)
      // The API might need more audio data to detect behavioral signals
      const recordDuration = Math.min(Math.max(analysisInterval, 3000), 5000);

      // Create MediaRecorder with error handling
      // Since we're recording a video container with both video and audio tracks,
      // we should specify both videoBitsPerSecond and audioBitsPerSecond (matching VideoPlayer)
      let mediaRecorder: MediaRecorder;
      try {
        // Try to create with preferred settings (both video and audio bitrates)
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000, // 2.5 Mbps for video (matches VideoPlayer, even for static canvas)
          audioBitsPerSecond: 128000, // 128 kbps for audio
        });
      } catch (error) {
        // Fallback: try without explicit MIME type (let browser choose)
        console.warn('Failed to create MediaRecorder with specified MIME type, trying browser default:', error);
        try {
          mediaRecorder = new MediaRecorder(stream, {
            videoBitsPerSecond: 2500000,
            audioBitsPerSecond: 128000,
          });
          console.log(`Using browser default MIME type: ${mediaRecorder.mimeType}`);
        } catch (fallbackError) {
          // Last resort: try with minimal options
          console.warn('Failed to create MediaRecorder with quality settings, trying minimal options:', fallbackError);
          mediaRecorder = new MediaRecorder(stream);
          console.log(`Using minimal MediaRecorder options, MIME type: ${mediaRecorder.mimeType}`);
        }
      }

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:272',message:'MediaRecorder created',data:{mimeType:mediaRecorder.mimeType,state:mediaRecorder.state,audioBitsPerSecond:mediaRecorder.audioBitsPerSecond,videoBitsPerSecond:mediaRecorder.videoBitsPerSecond,streamAudioTracks:stream.getAudioTracks().length,streamVideoTracks:stream.getVideoTracks().length,streamActive:stream.active,hasVideoCodec:mimeType.includes('vp8')||mimeType.includes('vp9')||mimeType.includes('avc1')},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // Collect recorded chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:254',message:'Starting recording',data:{recordDuration,streamAudioTracks:stream.getAudioTracks().length,streamVideoTracks:stream.getVideoTracks().length,videoTrackReadyState:stream.getVideoTracks()[0]?.readyState,audioTrackReadyState:stream.getAudioTracks()[0]?.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
      // Start recording
      mediaRecorder.start();

      // Wait for the recording duration
      await new Promise<void>((resolve, reject) => {
        let timeout: NodeJS.Timeout | null = null;
        let checkInterval: NodeJS.Timeout | null = null;
        let isResolved = false;

        const cleanup = () => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
          }
        };

        const resolveOnce = () => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve();
          }
        };

        const rejectOnce = (error: Error) => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            reject(error);
          }
        };

        timeout = setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            try {
              mediaRecorder.requestData();
            } catch (e) {
              // Some browsers may not support requestData
            }
            mediaRecorder.stop();
          }
        }, recordDuration);

        mediaRecorder.onstop = () => {
          setTimeout(() => {
            if (recordedChunksRef.current.length === 0) {
              setTimeout(() => {
                resolveOnce();
              }, 200);
            } else {
              resolveOnce();
            }
          }, 150);
        };

        mediaRecorder.onerror = (event) => {
          rejectOnce(new Error('MediaRecorder error'));
        };

        // Check if stream is still active during recording
        checkInterval = setInterval(() => {
          if (!isStreamActiveRef.current) {
            if (mediaRecorder.state === 'recording') {
              try {
                mediaRecorder.requestData();
              } catch (e) {
                // Ignore if requestData fails
              }
              mediaRecorder.stop();
            }
            setTimeout(() => {
              if (recordedChunksRef.current.length === 0) {
                rejectOnce(new Error('Stream stopped'));
              } else {
                resolveOnce();
              }
            }, 150);
          }
        }, 100);
      });

      // Check again if stream is still active after recording
      if (!isStreamActiveRef.current) {
        return;
      }

      // Combine recorded chunks into a single blob
      if (recordedChunksRef.current.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Create blob with video MIME type (API expects video format even for audio-only)
      const audioBlob = new Blob(recordedChunksRef.current, { type: mimeType });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:366',message:'Audio blob created (as video format)',data:{blobSize:audioBlob.size,blobType:audioBlob.type,mimeType,chunksCount:recordedChunksRef.current.length,isVideoFormat:mimeType.startsWith('video/'),recordDuration,chunksTotalSize:recordedChunksRef.current.reduce((sum,chunk)=>sum+chunk.size,0)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      
      // Validate blob size
      if (audioBlob.size === 0) {
        throw new Error('Recorded audio blob is empty');
      }

      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert blob to base64'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(audioBlob);
      });

      // Check again if stream is still active before making request
      if (!isStreamActiveRef.current) {
        return;
      }

      // Send audio segment for analysis with abort signal
      // Note: The API expects videoData, but we'll send audio as video with no video track
      // The API should handle audio-only files
      const apiRequestStart = Date.now();
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoData: base64Data, // API expects videoData field name
          format: 'base64',
          metadata: {
            timestamp: Date.now(),
          },
        }),
        signal: abortController.signal,
      });
      const apiRequestDuration = Date.now() - apiRequestStart;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:280',message:'API request completed',data:{durationMs:apiRequestDuration,status:response.status,blobSize:audioBlob.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:297',message:'API response received',data:{signalsCount:data.signals?.length||0,signals:data.signals?.map((s:any)=>({type:s.type,intensity:s.intensity}))||[],responseStatus:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // Final check before updating signals
      if (!isStreamActiveRef.current) {
        return;
      }
      
      // Update signals if we got valid data and stream is still active
      if (data.signals && Array.isArray(data.signals)) {
        const currentTime = Date.now();
        const baseSignals: BehavioralSignal[] = data.signals.map((signal: any) => ({
          type: signal.type,
          intensity: signal.intensity || 0,
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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:333',message:'Signals updated',data:{signalsCount:enhancedSignals.length,signals:enhancedSignals.map(s=>({type:s.type,intensity:s.intensity}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
      }
    } catch (error) {
      // Ignore abort errors (expected when stream stops)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error during audio segment analysis:', error);
    } finally {
      // Clean up MediaRecorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      recordedChunksRef.current = [];
      
      // Cancel any pending animation frames
      if (typeof cancelAnimationFrame !== 'undefined') {
        // Animation frame was set in the captureAndAnalyze function scope
      }

      // Only clear analyzing state if stream is still active
      if (isStreamActiveRef.current) {
        setIsAnalyzing(false);
      }
      abortControllerRef.current = null;
    }
  }, [enabled, isAnalyzing, onSignalsUpdate, getSupportedMimeType, analysisInterval, signalAggregator]);

  const handleStreamReady = useCallback((stream: MediaStream) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:360',message:'handleStreamReady called',data:{hasStream:!!stream,audioTracks:stream?.getAudioTracks().length||0,videoTracks:stream?.getVideoTracks().length||0,hasOnSignalsUpdate:!!onSignalsUpdate,enabled,analysisInterval},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Mark stream as active and store stream reference in both state and ref
    isStreamActiveRef.current = true;
    streamRef.current = stream; // Store in ref for immediate access
    setCurrentStream(stream); // Also store in state for UI updates

    // Start periodic analysis if enabled
    if (enabled && analysisInterval > 0) {
      // Clear any existing interval
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }

      // Sequential analysis: start first one immediately, then schedule next after completion
      const runAnalysis = async () => {
        if (!isStreamActiveRef.current) {
          return;
        }
        
        try {
          await captureAndAnalyze();
        } catch (error) {
          // Errors are already logged in captureAndAnalyze
        }
        
        // Schedule next analysis after the interval, but only if stream is still active
        if (isStreamActiveRef.current && enabled) {
          analysisIntervalRef.current = setTimeout(runAnalysis, analysisInterval) as any;
        }
      };
      
      // Start first analysis
      runAnalysis();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:395',message:'Sequential analysis started',data:{intervalMs:analysisInterval},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }

    onStreamReady?.(stream);
  }, [enabled, analysisInterval, captureAndAnalyze, onStreamReady, onSignalsUpdate]);

  const handleStreamStop = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:410',message:'handleStreamStop called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Mark stream as inactive and clear stream reference
    isStreamActiveRef.current = false;
    streamRef.current = null; // Clear ref
    setCurrentStream(null); // Clear state
    
    // Stop canvas stream if active
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach(track => track.stop());
      canvasStreamRef.current = null;
    }
    
    // Clear canvas update interval
    if (canvasUpdateIntervalRef.current) {
      clearInterval(canvasUpdateIntervalRef.current);
      canvasUpdateIntervalRef.current = null;
    }

    // Clear analysis interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      clearTimeout(analysisIntervalRef.current as any);
      analysisIntervalRef.current = null;
    }

    // Stop any active MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.warn('Error stopping MediaRecorder:', error);
      }
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];

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

    onStreamStop?.();
  }, [onStreamStop, onSignalsUpdate, signalAggregator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        clearTimeout(analysisIntervalRef.current as any);
      }
    };
  }, []);

  // Update analysis when enabled state changes
  useEffect(() => {
    if (!enabled && analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
  }, [enabled]);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioPlayer.tsx:52',message:'AudioPlayer render',data:{hasOnSignalsUpdate:!!onSignalsUpdate,enabled,isStreamActive:isStreamActiveRef.current,hasStream:!!currentStream},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [onSignalsUpdate, enabled, currentStream]);
  // #endregion

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Audio capture component */}
      <AudioCapture
        onStreamReady={handleStreamReady}
        onStreamError={onStreamError}
        onStreamStop={handleStreamStop}
        autoStart={autoStart}
        className="absolute inset-0 z-10"
      />

      {/* Subtitles overlay */}
      <Subtitles
        enabled={enabled && isStreamActiveRef.current}
        stream={currentStream}
        className="pb-4"
      />

      {/* Analysis status indicator */}
      {isAnalyzing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 glass-dark px-4 py-2 rounded-full border border-blue-500/30 animate-scale-in shadow-lg" style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400/30"></div>
              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-blue-400 absolute top-0 left-0"></div>
            </div>
            <span className="text-white text-xs font-semibold tracking-wide">Analyzing audio...</span>
          </div>
        </div>
      )}
    </div>
  );
}

