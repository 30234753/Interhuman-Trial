'use client';

import VideoPlayer from './components/VideoPlayer';
import { useState } from 'react';
import { BehavioralSignal } from './lib/types';

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<string>('Not started');
  const [currentSignals, setCurrentSignals] = useState<BehavioralSignal[]>([]);

  const getStatusColor = () => {
    if (streamStatus.includes('Error')) return 'text-red-500';
    if (streamStatus.includes('active')) return 'text-orange-400';
    if (streamStatus.includes('stopped')) return 'text-gray-400';
    return 'text-orange-500';
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 max-w-6xl w-full items-center justify-between animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up pt-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-normal pb-2 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent px-4">
            Roleplay Body Language Analyser
          </h1>
          <p className="text-gray-400 text-sm md:text-base mt-2">
            Real-time behavioural analysis powered by AI
          </p>
        </div>
        
        {/* Status Card */}
        <div className="glass-dark rounded-2xl p-4 md:p-6 mb-6 backdrop-blur-xl border border-white/10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')} animate-pulse`}></div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                <p className={`text-base md:text-lg font-semibold ${getStatusColor()} transition-colors duration-300`}>
                  {streamStatus}
                </p>
              </div>
            </div>
            {currentSignals.length > 0 && (
              <div className="flex items-center gap-2 animate-scale-in">
                <div className="px-3 py-1.5 bg-orange-500/20 backdrop-blur-sm rounded-full border border-orange-500/30">
                  <span className="text-sm font-medium text-orange-300">
                    {currentSignals.length} signal{currentSignals.length !== 1 ? 's' : ''} active
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Video Player Container */}
        <div className="w-full max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="glass-dark rounded-2xl p-4 md:p-6 backdrop-blur-xl border border-white/10 shadow-2xl">
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
              className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-600/50"
            />
          </div>
        </div>
      </div>
    </main>
  );
}