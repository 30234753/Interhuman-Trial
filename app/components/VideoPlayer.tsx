'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import VideoCapture, { VideoCaptureProps } from './VideoCapture';
import FeedbackOverlay from './FeedbackOverlay';
import Subtitles from './Subtitles';
import { BehavioralSignal } from '@/app/lib/types';
import { SignalAggregator } from '@/app/lib/signal-aggregator';

export interface VideoPlayerProps extends Omit<VideoCaptureProps, 'onStreamReady'> {
  onStreamReady?: (stream: MediaStream) => void;
  onSignalsUpdate?: (signals: BehavioralSignal[]) => void;
  analysisInterval?: number; // Interval in milliseconds between frame captures
  enabled?: boolean; // Whether to enable real-time analysis
  /** When true, run behavioral analysis; when false, do not call captureAndAnalyze / onSignalsUpdate (answer window only) */
  answerWindowActive?: boolean;
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
  answerWindowActive = false,
  className = '',
  ...videoCaptureProps
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentSignals, setCurrentSignals] = useState<BehavioralSignal[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamActiveRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
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
   * Detects the best supported MIME type for MediaRecorder
   * Prioritizes formats with audio codec support, falls back to video-only
   * Handles browser compatibility and codec detection
   */
  const getSupportedMimeType = useCallback((): string | null => {
    // Check if MediaRecorder is available
    if (typeof MediaRecorder === 'undefined') {
      console.error('MediaRecorder is not supported in this browser');
      return null;
    }

    // Priority list: formats with audio codecs first, then video-only
    // Order matters - we prefer WebM with Opus audio (most widely supported)
    const preferredTypes = [
      // WebM with audio (best quality, widely supported)
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,vorbis', // Alternative audio codec
      'video/webm;codecs=vp9,vorbis',
      // WebM video-only (fallback if audio codec not supported)
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9',
      'video/webm', // Generic WebM (browser will choose codec)
      // MP4 formats (less browser support, but common)
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC
      'video/mp4;codecs=avc1.42E01E', // H.264 video-only
      'video/mp4', // Generic MP4
      // Other formats as fallback
      'video/ogg;codecs=theora,vorbis',
      'video/ogg;codecs=theora',
      'video/ogg',
    ];

    // Test each type in priority order
    for (const type of preferredTypes) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          console.log(`Using MediaRecorder MIME type: ${type}`);
          return type;
        }
      } catch (error) {
        // Some browsers may throw errors on isTypeSupported for certain formats
        // Continue to next type
        console.debug(`MediaRecorder.isTypeSupported failed for ${type}:`, error);
      }
    }

    // If no specific type is supported, try to get default type
    // Some browsers support MediaRecorder but don't report specific codecs
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
   * Records a video segment from the stream and sends it for analysis
   */
  const captureAndAnalyze = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:118',message:'captureAndAnalyze called',data:{isStreamActive:isStreamActiveRef.current,enabled,isAnalyzing},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
    // #endregion
    
    // Only run analysis during answer window
    if (!answerWindowActive) {
      return;
    }

    // Check if stream is still active before starting analysis
    if (!isStreamActiveRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:121',message:'Early return: stream not active',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      return;
    }

    const video = getVideoElement();
    if (!video || !enabled || isAnalyzing) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:127',message:'Early return: video/enabled/isAnalyzing check',data:{hasVideo:!!video,enabled,isAnalyzing},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    // Check if video is ready and playing
    if (video.readyState < 2 || video.paused || video.ended) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:130',message:'Early return: video not ready',data:{readyState:video.readyState,paused:video.paused,ended:video.ended},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      return;
    }

    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined' || !window.MediaRecorder) {
      console.error('MediaRecorder is not supported in this browser. Please use a modern browser like Chrome, Firefox, Edge, or Safari 14.3+');
      return;
    }

    // Get the MediaStream from the video element
    const stream = video.srcObject as MediaStream;
    if (!stream || !stream.active) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:141',message:'Early return: no stream or stream inactive',data:{hasStream:!!stream,streamActive:stream?.active},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
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
        throw new Error('No supported video codec found. Your browser may not support video recording.');
      }

      // Check if audio tracks are available
      const audioTracks = stream.getAudioTracks();
      const hasAudio = audioTracks.length > 0 && audioTracks[0].enabled;
      
      // Check if the selected MIME type supports audio
      const mimeTypeSupportsAudio = mimeType.includes('opus') || 
                                    mimeType.includes('vorbis') || 
                                    mimeType.includes('aac') ||
                                    mimeType.includes('mp4a');
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:164',message:'Audio track detection',data:{audioTrackCount:audioTracks.length,hasAudio,audioTracksEnabled:audioTracks.map(t=>({id:t.id,enabled:t.enabled,kind:t.kind,label:t.label,readyState:t.readyState})),mimeType,mimeTypeSupportsAudio,streamActive:stream.active,videoTracks:stream.getVideoTracks().length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Log information about recording capabilities
      if (hasAudio && mimeTypeSupportsAudio) {
        console.log('Recording with audio support');
      } else if (hasAudio && !mimeTypeSupportsAudio) {
        console.warn('Audio tracks available but selected codec does not support audio, recording video-only');
      } else if (!hasAudio) {
        console.warn('No audio tracks available, recording video-only');
      }

      // Record duration: 2-3 seconds (use analysisInterval as base, but cap at 3 seconds)
      const recordDuration = Math.min(Math.max(analysisInterval, 2000), 3000);

      // Create MediaRecorder with error handling
      let mediaRecorder: MediaRecorder;
      try {
        // Try to create with preferred settings
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
        });
      } catch (error) {
        // Fallback: try without explicit MIME type (let browser choose)
        console.warn('Failed to create MediaRecorder with specified MIME type, trying browser default:', error);
        try {
          mediaRecorder = new MediaRecorder(stream, {
            videoBitsPerSecond: 2500000,
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
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:210',message:'MediaRecorder created',data:{mimeType:mediaRecorder.mimeType,state:mediaRecorder.state,audioBitsPerSecond:mediaRecorder.audioBitsPerSecond,videoBitsPerSecond:mediaRecorder.videoBitsPerSecond,streamAudioTracks:stream.getAudioTracks().length,streamVideoTracks:stream.getVideoTracks().length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Collect recorded chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:217',message:'Chunk recorded',data:{chunkSize:event.data.size,chunkType:event.data.type,totalChunks:recordedChunksRef.current.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
      };

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
            // Request final data before stopping to ensure we get all chunks
            try {
              mediaRecorder.requestData();
            } catch (e) {
              // Some browsers may not support requestData, that's okay
            }
            mediaRecorder.stop();
          }
          // Don't resolve immediately - wait for onstop and data to arrive
        }, recordDuration);

        mediaRecorder.onstop = () => {
          // Add a delay to ensure all dataavailable events have fired
          // This handles the async nature of ondataavailable
          // Use a longer delay and check if we have chunks before resolving
          setTimeout(() => {
            // If we still don't have chunks after delay, wait a bit more
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
            // Don't reject immediately - let onstop fire first to collect any final chunks
            setTimeout(() => {
              if (recordedChunksRef.current.length === 0) {
                rejectOnce(new Error('Stream stopped'));
              } else {
                // We have chunks, resolve instead of reject
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:314',message:'About to create blob',data:{chunksCount:recordedChunksRef.current.length,chunksSizes:recordedChunksRef.current.map(c=>c.size),mediaRecorderState:mediaRecorder.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
      // #endregion
      
      // If no chunks yet, wait a bit more (shouldn't happen with the improved onstop handler, but just in case)
      if (recordedChunksRef.current.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:325',message:'Video blob created',data:{blobSize:videoBlob.size,blobType:videoBlob.type,chunksCount:recordedChunksRef.current.length,hasAudioCodec:mimeType.includes('opus')||mimeType.includes('vorbis')||mimeType.includes('aac')||mimeType.includes('mp4a'),originalMimeType:mimeType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // Validate blob size (should be > 0)
      if (videoBlob.size === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:337',message:'Empty blob detected',data:{chunksCount:recordedChunksRef.current.length,chunksSizes:recordedChunksRef.current.map(c=>c.size),waited:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'O'})}).catch(()=>{});
        // #endregion
        throw new Error('Recorded video blob is empty');
      }

      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:300',message:'Base64 conversion complete',data:{dataUrlPrefix:reader.result.substring(0,Math.min(50,reader.result.length)),base64Length:reader.result.length,detectedMimeType:reader.result.match(/^data:([^;,]+)/)?.[1]||'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert blob to base64'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(videoBlob);
      });

      // Check again if stream is still active before making request
      if (!isStreamActiveRef.current) {
        return;
      }

      // Send video segment for analysis with abort signal
      const apiRequestStart = Date.now();
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
      const apiRequestDuration = Date.now() - apiRequestStart;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:360',message:'API request timing',data:{durationMs:apiRequestDuration,status:response.status,blobSize:videoBlob.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
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
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:272',message:'API response received',data:{signalsCount:data.signals?.length||0,signals:data.signals?.map((s:any)=>({type:s.type,intensity:s.intensity}))||[],responseStatus:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:465',message:'Calling onSignalsUpdate',data:{enhancedSignalsCount:enhancedSignals.length,enhancedSignals:enhancedSignals.map(s=>({type:s.type,intensity:s.intensity,timestamp:s.timestamp})),baseSignalsCount:baseSignals.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        onSignalsUpdate?.(enhancedSignals);
      }
    } catch (error) {
      // Ignore abort errors (expected when stream stops)
      if (error instanceof Error && error.name === 'AbortError') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:418',message:'Analysis aborted (expected)',data:{errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:421',message:'Error during analysis',data:{errorName:error instanceof Error?error.name:'unknown',errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      console.error('Error during video segment analysis:', error);
    } finally {
      // Clean up MediaRecorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      recordedChunksRef.current = [];

      // Only clear analyzing state if stream is still active
      if (isStreamActiveRef.current) {
        setIsAnalyzing(false);
      }
      abortControllerRef.current = null;
    }
  }, [enabled, answerWindowActive, isAnalyzing, onSignalsUpdate, getVideoElement, getSupportedMimeType, analysisInterval]);

  /**
   * Starts the sequential analysis loop. Only runs when answerWindowActive and enabled.
   * Used when stream becomes ready and when answerWindowActive turns true mid-session.
   */
  const startAnalysisLoop = useCallback(() => {
    if (!enabled || analysisInterval <= 0 || !answerWindowActive) {
      return;
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      clearTimeout(analysisIntervalRef.current as any);
      analysisIntervalRef.current = null;
    }
    const runAnalysis = async () => {
      if (!isStreamActiveRef.current) {
        return;
      }
      try {
        await captureAndAnalyze();
      } catch (error) {
        // Errors are already logged in captureAndAnalyze
      }
      // Schedule next only if stream still active, enabled, and still in answer window
      if (isStreamActiveRef.current && enabled && answerWindowActive) {
        analysisIntervalRef.current = setTimeout(runAnalysis, analysisInterval) as any;
      }
    };
    runAnalysis();
  }, [enabled, analysisInterval, answerWindowActive, captureAndAnalyze]);

  /**
   * Handles stream ready event and starts analysis loop (only when answer window is active)
   */
  const handleStreamReady = useCallback((stream: MediaStream) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.tsx:424',message:'handleStreamReady called',data:{enabled,analysisInterval,streamActive:stream.active,audioTracks:stream.getAudioTracks().length,videoTracks:stream.getVideoTracks().length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
    // #endregion

    isStreamActiveRef.current = true;
    setCurrentStream(stream);

    if (enabled && analysisInterval > 0 && answerWindowActive) {
      startAnalysisLoop();
    }

    onStreamReady?.(stream);
  }, [enabled, analysisInterval, answerWindowActive, startAnalysisLoop, onStreamReady]);

  /**
   * Handles stream stop and cleans up analysis interval
   */
  const handleStreamStop = useCallback(() => {
    // Mark stream as inactive and clear stream reference
    isStreamActiveRef.current = false;
    setCurrentStream(null);

    // Clear analysis interval (works for both setInterval and setTimeout)
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

    videoCaptureProps.onStreamStop?.();
  }, [videoCaptureProps, onSignalsUpdate, signalAggregator]);

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
  // Only disable analysis if enabled becomes false - don't restart if already running
  useEffect(() => {
    if (!enabled && analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      clearTimeout(analysisIntervalRef.current as any);
      analysisIntervalRef.current = null;
    }
  }, [enabled]);

  // Start/stop analysis loop when answer window opens/closes
  useEffect(() => {
    if (!answerWindowActive) {
      if (analysisIntervalRef.current) {
        clearTimeout(analysisIntervalRef.current as any);
        analysisIntervalRef.current = null;
      }
      return;
    }
    if (isStreamActiveRef.current && enabled && analysisInterval > 0) {
      startAnalysisLoop();
    }
  }, [answerWindowActive, enabled, analysisInterval, startAnalysisLoop]);

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

      {/* Subtitles overlay – fixed padding so position doesn't jolt when signals appear */}
      <Subtitles
        enabled={enabled && isStreamActiveRef.current}
        stream={currentStream}
        className="pb-20"
      />

      {/* Analysis status indicator */}
      {isAnalyzing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/90 backdrop-blur-md px-4 py-2 rounded-full border border-turquoise-500/50 animate-scale-in shadow-lg" style={{ boxShadow: '0 0 20px rgba(20, 184, 166, 0.4)' }}>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-turquoise-400/30"></div>
              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-turquoise-400 absolute top-0 left-0"></div>
            </div>
            <span className="text-white text-xs font-semibold tracking-wide">Analyzing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

