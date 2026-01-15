'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SpeechRecognitionWrapper } from '@/app/lib/speech-recognition-wrapper';

export interface SubtitlesProps {
  enabled?: boolean;
  stream?: MediaStream | null;
  className?: string;
}

/**
 * Real-time subtitles component using Speech Recognition Wrapper
 * Uses Web Speech API for Chrome/Safari, Vosk for Edge fallback
 */
export default function Subtitles({
  enabled = true,
  stream = null,
  className = '',
}: SubtitlesProps) {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<SpeechRecognitionWrapper | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const interimTranscriptRef = useRef<string>('');

  // Initialize Speech Recognition Wrapper
  useEffect(() => {
    if (!wrapperRef.current) {
      wrapperRef.current = new SpeechRecognitionWrapper({
        continuous: true,
        interimResults: true,
        lang: 'en-US',
      });
    }

    const wrapper = wrapperRef.current;

    // Start recognition if enabled and stream is available
    if (enabled && stream && stream.active && wrapper.isReady()) {
      const audioTracks = stream.getAudioTracks() || [];
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
      const isEdge = userAgent.includes('Edg/');

      // For Edge, wait for audio tracks to be ready
      const startRecognition = () => {
        wrapper.start(stream, {
          onResult: (text: string, isFinal: boolean) => {
            if (isFinal) {
              // Add to final transcript (text is already just the new part)
              finalTranscriptRef.current += text + ' ';
              // Clear interim transcript when text becomes final to prevent duplication
              interimTranscriptRef.current = '';
              // Rebuild display transcript
              const display = finalTranscriptRef.current.trim() + (interimTranscriptRef.current ? ' ' + interimTranscriptRef.current : '');
              setTranscript(display.slice(-200)); // Limit to last 200 chars
            } else {
              // Update interim transcript
              interimTranscriptRef.current = text;
              // Rebuild display transcript
              const display = finalTranscriptRef.current.trim() + (interimTranscriptRef.current ? ' ' + interimTranscriptRef.current : '');
              setTranscript(display.slice(-200));
            }
          },
          onError: (errorMsg: string) => {
            // Don't show "no-speech" errors - they're normal
            if (errorMsg !== 'no-speech') {
              setError(errorMsg);
            }
            setIsListening(false);
          },
          onStart: () => {
            setIsListening(true);
            setError(null);
          },
          onEnd: () => {
            setIsListening(false);
            // Clear interim transcript when recognition ends
            interimTranscriptRef.current = '';
          },
        });
      };

      if (isEdge && audioTracks.length > 0) {
        // Wait for audio tracks to be in 'live' state before starting
        const checkAndStart = () => {
          const liveTracks = audioTracks.filter(t => t.readyState === 'live' && t.enabled && !t.muted);
          if (liveTracks.length > 0) {
            // Add delay for Edge
            setTimeout(startRecognition, 500);
          } else {
            setTimeout(checkAndStart, 100);
          }
        };
        setTimeout(checkAndStart, 500);
      } else {
        startRecognition();
      }
    }

    // Cleanup on unmount
    return () => {
      if (wrapper) {
        wrapper.stop();
      }
    };
  }, [enabled, stream]);

  // Handle stream changes
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !wrapper.isReady()) return;

    if (enabled && stream && stream.active && !isListening) {
      // Start recognition when stream becomes active
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
      const isEdge = userAgent.includes('Edg/');
      const audioTracks = stream.getAudioTracks() || [];

      const startRecognition = () => {
        wrapper.start(stream, {
          onResult: (text: string, isFinal: boolean) => {
            if (isFinal) {
              finalTranscriptRef.current += text + ' ';
              // Clear interim transcript when text becomes final to prevent duplication
              interimTranscriptRef.current = '';
              const display = finalTranscriptRef.current.trim() + (interimTranscriptRef.current ? ' ' + interimTranscriptRef.current : '');
              setTranscript(display.slice(-200));
            } else {
              interimTranscriptRef.current = text;
              const display = finalTranscriptRef.current.trim() + (interimTranscriptRef.current ? ' ' + interimTranscriptRef.current : '');
              setTranscript(display.slice(-200));
            }
          },
          onError: (errorMsg: string) => {
            if (errorMsg !== 'no-speech') {
              setError(errorMsg);
            }
            setIsListening(false);
          },
          onStart: () => {
            setIsListening(true);
            setError(null);
          },
          onEnd: () => {
            setIsListening(false);
            interimTranscriptRef.current = '';
          },
        });
      };

      if (isEdge && audioTracks.length > 0) {
        const liveTracks = audioTracks.filter(t => t.readyState === 'live' && t.enabled && !t.muted);
        if (liveTracks.length > 0) {
          setTimeout(startRecognition, 100);
        } else {
          setTimeout(() => {
            const retryTracks = stream?.getAudioTracks() || [];
            const retryLive = retryTracks.filter(t => t.readyState === 'live' && t.enabled && !t.muted);
            if (retryLive.length > 0) {
              startRecognition();
            }
          }, 200);
        }
      } else {
        startRecognition();
      }
    } else if ((!enabled || !stream || !stream.active) && isListening) {
      // Stop recognition when stream stops or is disabled
      wrapper.stop();
    }
  }, [enabled, stream, isListening]);

  // Clear transcript when stream stops
  useEffect(() => {
    if (!stream || !stream.active) {
      setTranscript('');
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
    }
  }, [stream]);

  // Clear transcript manually
  const clearTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <div className={`absolute bottom-0 left-0 right-0 z-30 ${className}`}>
      {/* Subtitles Container */}
      <div className="glass-dark rounded-t-lg px-4 py-3 backdrop-blur-xl border-t border-white/10 border-l border-r border-white/5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          {/* Transcript Text */}
          <div className="flex-1 min-w-0">
            {transcript ? (
              <p className="text-white text-sm md:text-base font-medium leading-relaxed break-words">
                {transcript}
                {interimTranscriptRef.current && (
                  <span className="text-orange-300/70 italic">
                    {interimTranscriptRef.current}
                  </span>
                )}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                {isListening ? (
                  <>
                    <div className="relative">
                      <div className="animate-pulse h-2 w-2 bg-orange-400 rounded-full"></div>
                      <div className="animate-ping absolute top-0 left-0 h-2 w-2 bg-orange-400 rounded-full opacity-75"></div>
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
                  <div className="h-2 w-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <div className="absolute top-0 left-0 h-2 w-2 bg-orange-400 rounded-full animate-ping opacity-75"></div>
                </div>
                <span className="text-orange-400 text-xs font-semibold hidden sm:inline">
                  LIVE
                </span>
              </div>
            )}

            {/* Clear Button */}
            {transcript && (
              <button
                onClick={clearTranscript}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors duration-200 text-gray-400 hover:text-orange-400"
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
