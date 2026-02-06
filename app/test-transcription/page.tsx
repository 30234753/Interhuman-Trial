'use client';

import { useState, useRef, useEffect } from 'react';
import Subtitles from '../components/Subtitles';

/**
 * Test page for Deepgram transcription integration
 * Isolated testing environment for audio capture and real-time transcription
 */
export default function TestTranscriptionPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request microphone access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false, // Audio only for transcription testing
      });

      setStream(mediaStream);
      setIsRecording(true);

      // Set stream to video element for visual feedback (even though it's audio-only)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((err) => {
          console.error('Error playing audio stream:', err);
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(errorMessage);
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsRecording(false);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-turquoise-500/10 rounded-full blur-3xl"></div>
      </div>
      <div className="z-10 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
            Transcription Test
          </h1>
          <p className="text-gray-700 text-sm md:text-base">
            Test audio capture and real-time transcription
          </p>
        </div>

        {/* Control Panel */}
        <div className="glass-dark rounded-2xl p-6 md:p-8 backdrop-blur-xl border border-white/10 shadow-2xl mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-gradient-to-r from-realtalk-dark to-realtalk-blue hover:from-realtalk-dark hover:to-realtalk-blue active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 active:scale-95 rounded-lg text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Recording
                </button>
              )}
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              {isRecording ? (
                <>
                  <div className="relative">
                    <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
                    <div className="absolute top-0 left-0 h-3 w-3 bg-red-500 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <span className="text-red-400 text-sm font-semibold">RECORDING</span>
                </>
              ) : (
                <span className="text-gray-700 text-sm">Not recording</span>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm font-medium">Error: {error}</p>
            </div>
          )}

          {/* Audio Stream Info */}
          {stream && (
            <div className="mb-4 p-4 bg-turquoise-500/20 border border-turquoise-500/30 rounded-lg">
              <p className="text-turquoise-300 text-sm font-medium mb-2">Audio Stream Active</p>
              <div className="text-turquoise-200 text-xs space-y-1">
                <p>Audio Tracks: {stream.getAudioTracks().length}</p>
                {stream.getAudioTracks().map((track, idx) => (
                  <p key={idx} className="ml-4">
                    Track {idx + 1}: {track.label} ({track.enabled ? 'enabled' : 'disabled'}, {track.readyState})
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Hidden video element for audio stream (for debugging) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="hidden"
          />
        </div>

        {/* Transcription Display */}
        <div className="glass-dark rounded-2xl p-6 md:p-8 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Live Transcription</h2>
            {isRecording && (
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>WebSocket Active</span>
              </div>
            )}
          </div>
          <div className="relative min-h-[200px] bg-black/30 rounded-lg p-4 border border-white/5">
            <Subtitles
              enabled={isRecording}
              stream={stream}
              className="relative"
            />
            
            {/* Placeholder when not recording */}
            {!isRecording && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-600 text-sm italic">
                  Start recording to see transcription results
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 glass-dark rounded-2xl p-6 backdrop-blur-xl border border-white/10 shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Test Instructions</h3>
          <ol className="text-gray-700 text-sm space-y-2 list-decimal list-inside">
            <li>Click &quot;Start Recording&quot; and grant microphone permissions</li>
            <li>Speak clearly into your microphone</li>
            <li>Watch for real-time transcription in the Live Transcription area</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
