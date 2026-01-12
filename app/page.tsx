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
              setStreamStatus(`Error: ${error.message}`);
            }}
            onStreamStop={() => {
              console.log('Stream stopped');
              setStreamStatus('Stream stopped');
            }}
            className="w-full aspect-video"
          />
        </div>
      </div>
    </main>
  );
}