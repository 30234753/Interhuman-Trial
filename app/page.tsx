'use client';

import VideoCapture from './components/VideoCapture';
import { useState } from 'react';

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<string>('Not started');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Roleplay Body Language Analyzer</h1>
        
        <div className="mt-8 mb-4">
          <p className="text-lg mb-2">Status: {streamStatus}</p>
        </div>

        <div className="w-full max-w-2xl mx-auto">
          <VideoCapture
            autoStart={false}
            onStreamReady={(stream) => {
              console.log('Stream ready:', stream);
              setStreamStatus('Streaming active');
            }}
            onStreamError={(error) => {
              console.error('Stream error:', error);
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  location: 'page.tsx:onStreamError',
                  message: 'Parent onStreamError called',
                  data: { errorMessage: error.message },
                  timestamp: Date.now(),
                  sessionId: 'debug-session',
                  runId: 'run1',
                  hypothesisId: 'C'
                })
              }).catch(() => {});
              // #endregion
              setStreamStatus(`Error: ${error.message}`);
            }}
            onStreamStop={() => {
              console.log('Stream stopped');
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  location: 'page.tsx:onStreamStop',
                  message: 'Parent onStreamStop called',
                  data: {},
                  timestamp: Date.now(),
                  sessionId: 'debug-session',
                  runId: 'run1',
                  hypothesisId: 'A'
                })
              }).catch(() => {});
              // #endregion
              setStreamStatus('Stream stopped');
            }}
            className="w-full aspect-video"
          />
        </div>
      </div>
    </main>
  );
}