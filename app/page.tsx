'use client';

import VideoPlayer from './components/VideoPlayer';
import { useState } from 'react';
import { BehavioralSignal } from './lib/types';

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<string>('Not started');
  const [currentSignals, setCurrentSignals] = useState<BehavioralSignal[]>([]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Roleplay Body Language Analyzer</h1>
        
        <div className="mt-8 mb-4">
          <p className="text-lg mb-2">Status: {streamStatus}</p>
          {currentSignals.length > 0 && (
            <p className="text-sm text-gray-400">
              {currentSignals.length} behavioral signal{currentSignals.length !== 1 ? 's' : ''} detected
            </p>
          )}
        </div>

        <div className="w-full max-w-2xl mx-auto">
          <VideoPlayer
            autoStart={false}
            enabled={true}
            analysisInterval={2000}
            onStreamReady={(stream) => {
              console.log('Stream ready:', stream);
              setStreamStatus('Streaming active - Analysis enabled');
            }}
            onStreamError={(error) => {
              console.error('Stream error:', error);
              setStreamStatus(`Error: ${error.message}`);
            }}
            onStreamStop={() => {
              console.log('Stream stopped');
              setStreamStatus('Stream stopped');
              setCurrentSignals([]);
            }}
            onSignalsUpdate={(signals) => {
              console.log('Signals updated:', signals);
              setCurrentSignals(signals);
            }}
            className="w-full aspect-video"
          />
        </div>
      </div>
    </main>
  );
}