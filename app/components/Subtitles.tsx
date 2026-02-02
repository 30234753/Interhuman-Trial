'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';
import { useSession } from '../lib/session-context';
import { useTranscript } from '../lib/transcript-context';

export interface SubtitlesProps {
  enabled?: boolean;
  stream?: MediaStream | null;
  className?: string;
}

/**
 * Real-time subtitles component using Deepgram live transcription
 * Displays transcribed speech from the microphone stream via client-side Deepgram WebSocket integration
 */
export default function Subtitles({
  enabled = true,
  stream = null,
  className = '',
}: SubtitlesProps) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { sessionState, addTranscriptChunk } = useSession();
  const {
    finalTranscript,
    interimTranscript,
    appendFinalChunk,
    setInterimTranscript: setInterimInContext,
    clearTranscript: clearTranscriptInContext,
  } = useTranscript();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptionSessionIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const deepgramConnectionRef = useRef<LiveClient | null>(null);
  const sendAudioChunkRef = useRef<((audioBlob: Blob, sessionId: string) => Promise<void>) | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const chunkOrderRef = useRef<number>(0);
  const lastSessionIdRef = useRef<string | null>(null);

  // Generate unique session ID for transcription
  const generateSessionId = useCallback(() => {
    return `transcription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Handle transcript updates (interim and final)
  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        appendFinalChunk(text);
        setInterimInContext('');

        if (sessionState.isActive && sessionState.sessionId && text.trim()) {
          const chunkOrder = chunkOrderRef.current++;
          const timestamp = Date.now();
          addTranscriptChunk(text.trim(), chunkOrder, timestamp).catch(
            (err) => {
              console.error('[Subtitles] Error saving transcript chunk:', err);
            }
          );
        }
      } else {
        setInterimInContext(text);
      }
    },
    [
      sessionState.isActive,
      sessionState.sessionId,
      addTranscriptChunk,
      appendFinalChunk,
      setInterimInContext,
    ]
  );

  // Start transcription session and connect directly to Deepgram WebSocket
  const startTranscriptionSession = useCallback(async (sessionId: string) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error('NEXT_PUBLIC_DEEPGRAM_API_KEY is not set. Please add it to your .env.local file.');
      }

      console.log('[Subtitles] Creating client-side Deepgram WebSocket connection...');
      
      // Create Deepgram client
      const deepgram = createClient(apiKey);

      // Deepgram configuration matching the API URL parameters
      // Reduced utteranceEndMs from 2000 to 500ms for faster results
      // Lower endpointing (30ms) for more frequent interim updates
      const connectionConfig = {
        model: 'nova-3',
        language: 'en',
        smartFormat: false,
        interimResults: true,
        punctuate: true,
        endpointing: 30, // Reduced from 100 for more frequent interim results
        utteranceEndMs: 500, // Reduced from 2000ms to 500ms for faster finalization
        vadEvents: true,
        mipOptOut: true,
      };

      // Create live WebSocket connection directly to Deepgram
      const connection = deepgram.listen.live(connectionConfig);
      deepgramConnectionRef.current = connection;

      // Set up event handlers
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('[Subtitles] Deepgram WebSocket connection opened');
        isListeningRef.current = true; // Update ref immediately so audio chunks can be sent
        setIsListening(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        try {
          const transcript = data.channel?.alternatives?.[0]?.transcript || '';
          const isFinal = data.is_final || false;
          
          if (transcript) {
            handleTranscript(transcript, isFinal);
          }
        } catch (error) {
          console.error('[Subtitles] Error parsing transcript:', error);
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('[Subtitles] Deepgram WebSocket error:', error);
        setError(error?.message || 'Deepgram connection error');
        isListeningRef.current = false; // Update ref when connection errors
        setIsListening(false);
        
        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (transcriptionSessionIdRef.current) {
              startTranscriptionSession(transcriptionSessionIdRef.current);
            }
          }, 1000 * reconnectAttemptsRef.current);
        } else {
          setError('Failed to connect to Deepgram after multiple attempts');
        }
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('[Subtitles] Deepgram WebSocket connection closed');
        isListeningRef.current = false; // Update ref when connection closes
        setIsListening(false);
        deepgramConnectionRef.current = null;
      });

    } catch (error) {
      console.error('[Subtitles] Error starting transcription session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start transcription');
      setIsListening(false);
    }
  }, [handleTranscript]);

  // Send audio chunk directly to Deepgram WebSocket (client-side)
  const sendAudioChunk = useCallback(async (audioBlob: Blob, sessionId: string) => {
    try {
      // Don't send audio if transcription session is not active or connection is not available
      if (!isListening || !sessionId || !deepgramConnectionRef.current) {
        return;
      }

      // Convert blob to ArrayBuffer for Deepgram WebSocket
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Send audio directly to Deepgram WebSocket connection
      deepgramConnectionRef.current.send(arrayBuffer);
      
      console.debug('[Subtitles] Audio chunk sent to Deepgram WebSocket:', {
        size: arrayBuffer.byteLength,
        sessionId,
      });
    } catch (error) {
      console.error('[Subtitles] Error sending audio chunk to Deepgram:', error);
      setError(error instanceof Error ? error.message : 'Failed to send audio to Deepgram');
    }
  }, [isListening]);

  // Update ref whenever sendAudioChunk changes
  useEffect(() => {
    sendAudioChunkRef.current = sendAudioChunk;
  }, [sendAudioChunk]);

  // Stop transcription session - close Deepgram WebSocket connection directly
  const stopTranscriptionSession = useCallback(async (sessionId: string) => {
    try {
      if (deepgramConnectionRef.current) {
        // Close the Deepgram WebSocket connection directly
        deepgramConnectionRef.current.finish();
        deepgramConnectionRef.current = null;
        console.log('[Subtitles] Deepgram WebSocket connection closed');
      }
    } catch (error) {
      console.error('[Subtitles] Error stopping transcription session:', error);
    }
  }, []);

  // Initialize MediaRecorder and start transcription
  useEffect(() => {
    if (!enabled || !stream || !stream.active) {
      return;
    }

    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      setError('MediaRecorder is not supported in this browser');
      return;
    }

    // Check if stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setError('No audio tracks found in stream');
      return;
    }

    let mediaRecorder: MediaRecorder | null = null;
    let sessionId: string | null = null;

    const initializeTranscription = async () => {
      try {
        // Generate session ID
        sessionId = generateSessionId();
        transcriptionSessionIdRef.current = sessionId;

        // Create MediaRecorder FIRST, before starting transcription session
        // This ensures we can start sending audio immediately when the Deepgram connection opens

        // Create MediaRecorder - extract audio-only stream if stream has video tracks
        // Some browsers fail when using audio-only MIME types with streams that have video tracks
        const audioTracksForRecording = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        // If stream has video tracks, create audio-only stream for MediaRecorder
        // This prevents issues with browsers that reject audio-only MIME types on video streams
        const streamForRecording = videoTracks.length > 0
          ? new MediaStream(audioTracksForRecording) // Audio-only stream
          : stream; // Use original stream if it's already audio-only

        // Try audio-only MIME types first
        let mimeType: string | undefined;
        const audioOnlyTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
        ];
        
        for (const type of audioOnlyTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
        
        // If no audio-only type is supported, try video types (which include audio)
        // This is a fallback for browsers that don't support audio-only recording
        if (!mimeType) {
          const videoTypes = [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm',
          ];
          for (const type of videoTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
              mimeType = type;
              break;
            }
          }
        }

        // Create MediaRecorder options
        const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
        
        // Only set audioBitsPerSecond for audio-only MIME types
        if (mimeType && mimeType.startsWith('audio/')) {
          recorderOptions.audioBitsPerSecond = 128000; // 128 kbps for good quality
        }

        mediaRecorder = new MediaRecorder(streamForRecording, recorderOptions);
        mediaRecorderRef.current = mediaRecorder;

        // Handle data available events (send chunks every 1-2 seconds)
        // Use the component-level isListeningRef to check if connection is ready
        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && sessionId && isListeningRef.current && sendAudioChunkRef.current) {
            await sendAudioChunkRef.current(event.data, sessionId);
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('[Subtitles] MediaRecorder error:', event);
          setError('Error capturing audio');
          setIsListening(false);
        };

        // Start recording with timeslice of 1000ms (1 second chunks)
        // Start MediaRecorder BEFORE starting transcription session to ensure audio flows immediately
        mediaRecorder.start(1000);

        // NOW start transcription session - MediaRecorder is already running and will send audio immediately
        await startTranscriptionSession(sessionId);
      } catch (error) {
        console.error('[Subtitles] Error initializing transcription:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize transcription');
        setIsListening(false);
      }
    };

    initializeTranscription();

    // Cleanup function
    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch (e) {
          console.debug('[Subtitles] Error stopping MediaRecorder:', e);
        }
      }

      if (sessionId) {
        stopTranscriptionSession(sessionId);
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      mediaRecorderRef.current = null;
      transcriptionSessionIdRef.current = null;
      isListeningRef.current = false; // Update ref on cleanup
      setIsListening(false);
    };
  }, [enabled, stream, generateSessionId, startTranscriptionSession, stopTranscriptionSession]);

  // Reset chunk order when session changes
  useEffect(() => {
    if (sessionState.sessionId !== lastSessionIdRef.current) {
      // Session changed - reset chunk order
      chunkOrderRef.current = 0;
      lastSessionIdRef.current = sessionState.sessionId;
    }
  }, [sessionState.sessionId]);

  // Clear transcript when stream stops
  useEffect(() => {
    if (!stream || !stream.active) {
      clearTranscriptInContext();
    }
  }, [stream, clearTranscriptInContext]);

  // Clear transcript manually (for UI button)
  const clearTranscript = useCallback(() => {
    clearTranscriptInContext();
  }, [clearTranscriptInContext]);

  if (!enabled) {
    return null;
  }

  return (
    <div className={`absolute bottom-[3rem] left-0 right-0 z-40 ${className}`}>
      {/* Subtitles Container */}
      <div className="glass-dark rounded-t-lg px-4 py-3 backdrop-blur-xl border-t border-white/10 border-l border-r border-white/5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          {/* Transcript Text */}
          <div className="flex-1 min-w-0">
            {finalTranscript || interimTranscript ? (
              <p className="text-gray-900 text-sm md:text-base font-medium leading-relaxed break-words">
                {finalTranscript && (
                  <span>{finalTranscript}</span>
                )}
                {interimTranscript && (
                  <span className="text-gray-600 italic">
                    {' ' + interimTranscript}
                  </span>
                )}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                {isListening ? (
                  <>
                    <div className="relative">
                      <div className="animate-pulse h-2 w-2 bg-purple-400 rounded-full"></div>
                      <div className="animate-ping absolute top-0 left-0 h-2 w-2 bg-purple-400 rounded-full opacity-75"></div>
                    </div>
                    <p className="text-gray-400 text-xs md:text-sm italic">
                      Listening for speech...
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 text-xs md:text-sm italic">
                    Waiting for audio...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Status and Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Listening Indicator */}
            {isListening && (
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <div className="h-2 w-2 bg-purple-400 rounded-full animate-pulse"></div>
                  <div className="absolute top-0 left-0 h-2 w-2 bg-purple-400 rounded-full animate-ping opacity-75"></div>
                </div>
                <span className="text-purple-400 text-xs font-semibold hidden sm:inline">
                  LIVE
                </span>
              </div>
            )}

            {/* Clear Button */}
            {(finalTranscript || interimTranscript) && (
              <button
                onClick={clearTranscript}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors duration-200 text-gray-400 hover:text-purple-400"
                aria-label="Clear transcript"
                title="Clear transcript"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-xs">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
