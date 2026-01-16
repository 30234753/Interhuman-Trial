'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface SubtitlesProps {
  enabled?: boolean;
  stream?: MediaStream | null;
  className?: string;
}

/**
 * Real-time subtitles component using Web Speech API
 * Displays transcribed speech from the microphone stream
 */
export default function Subtitles({
  enabled = true,
  stream = null,
  className = '',
}: SubtitlesProps) {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const interimTranscriptRef = useRef<string>('');

  // Initialize Speech Recognition
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:27',message:'Effect running - initializing recognition',data:{enabled,hasStream:!!stream,streamActive:stream?.active},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Check if Speech Recognition API is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = true; // Show interim results
    recognition.lang = 'en-US'; // Set language to English

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:38',message:'Recognition instance created',data:{hasExistingInstance:!!recognitionRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    recognition.onstart = () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:42',message:'Recognition started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      // #region agent log
      const allResults = [];
      for (let i = 0; i < event.results.length; i++) {
        allResults.push({
          index: i,
          transcript: event.results[i][0].transcript,
          isFinal: event.results[i].isFinal,
          confidence: event.results[i][0].confidence
        });
      }
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:47',message:'onresult fired',data:{resultIndex:event.resultIndex,totalResults:event.results.length,allResults,currentTranscript:transcript},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Build complete transcript from ALL final results (rebuild from scratch to avoid duplicates)
      // This ensures we never duplicate - we always rebuild the complete state
      let completeFinalTranscript = '';
      let latestInterimTranscript = '';

      // Process ALL results to rebuild complete state
      // This approach avoids duplication because we rebuild from scratch each time
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Add all final results to build complete final transcript
          completeFinalTranscript += result + ' ';
        } else {
          // Track the latest interim result (the last non-final result in the array)
          // This is what's currently being spoken/recognized
          latestInterimTranscript = result;
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:59',message:'Processed results',data:{completeFinalTranscript,latestInterimTranscript,hasFinal:!!completeFinalTranscript,hasInterim:!!latestInterimTranscript},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Update interim transcript ref with latest interim only
      interimTranscriptRef.current = latestInterimTranscript;

      // Always rebuild the transcript from all final results (prevents duplication)
      // Display: complete final transcript + latest interim
      setTranscript(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:66',message:'Rebuilding transcript from all final results',data:{completeFinalTranscript,latestInterimTranscript,display:completeFinalTranscript + latestInterimTranscript},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Rebuild from scratch: all final results + latest interim
        const display = completeFinalTranscript + latestInterimTranscript;
        // Limit to last 200 characters to prevent overflow
        return display.slice(-200);
      });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'no-speech':
          // Don't show error for no-speech, it's normal when user is silent
          return;
        case 'audio-capture':
          errorMessage = 'No microphone found or microphone access denied';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied';
          break;
        case 'network':
          errorMessage = 'Network error with speech recognition service';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not allowed';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMessage);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      
      // Auto-restart if enabled and stream is still active
      if (enabled && stream && stream.active) {
        try {
          recognition.start();
        } catch (e) {
          // Recognition might already be starting, ignore
          console.debug('Recognition restart:', e);
        }
      }
    };

    recognitionRef.current = recognition;

    // Start recognition if enabled and stream is available
    if (enabled && stream && stream.active) {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:127',message:'Starting recognition on init',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        recognition.start();
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:130',message:'Failed to start recognition',data:{error:e instanceof Error?e.message:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.error('Failed to start speech recognition:', e);
      }
    }

    // Cleanup on unmount
    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:134',message:'Cleanup - stopping recognition',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
        recognitionRef.current = null;
      }
    };
  }, [enabled, stream]);

  // Handle stream changes
  useEffect(() => {
    if (!recognitionRef.current) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:147',message:'Stream change effect',data:{enabled,hasStream:!!stream,streamActive:stream?.active,isListening},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (enabled && stream && stream.active && !isListening) {
      // Start recognition when stream becomes active
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:152',message:'Starting recognition from stream change',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        recognitionRef.current.start();
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:155',message:'Failed to start from stream change',data:{error:e instanceof Error?e.message:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.debug('Recognition start:', e);
      }
    } else if ((!enabled || !stream || !stream.active) && isListening) {
      // Stop recognition when stream stops or is disabled
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/64d3d2e4-78b5-4c8e-a18c-7ebac2888253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Subtitles.tsx:161',message:'Stopping recognition from stream change',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        recognitionRef.current.stop();
      } catch (e) {
        console.debug('Recognition stop:', e);
      }
    }
  }, [enabled, stream, isListening]);

  // Clear transcript when stream stops
  useEffect(() => {
    if (!stream || !stream.active) {
      setTranscript('');
      interimTranscriptRef.current = '';
    }
  }, [stream]);

  // Clear transcript manually
  const clearTranscript = useCallback(() => {
    setTranscript('');
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

