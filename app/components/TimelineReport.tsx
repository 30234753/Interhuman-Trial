'use client';

import { SessionData, BehavioralSignal, TranscriptChunk } from '@/app/lib/types';
import { useState, useMemo } from 'react';
import { calculateConfidenceScore } from '@/app/lib/signal-aggregator';

export interface TimelineReportProps {
  sessionData: SessionData;
  className?: string;
}

/**
 * Color mapping for different behavioral signal types (orange/black theme)
 * Matching SessionSummary component
 */
const SIGNAL_COLORS: Record<string, string> = {
  stress: '#f97316', // orange-500
  engagement: '#ea580c', // orange-600
  confusion: '#fb923c', // orange-400
  hesitation: '#fdba74', // orange-300
  agreement: '#ff8c42', // orange variant
  disagreement: '#c2410c', // orange-800
  disengagement: '#9a3412', // orange-900
  confidence: '#f97316', // orange-500
  frustration: '#ea580c', // orange-600
  interest: '#fb923c', // orange-400
  skepticism: '#c2410c', // orange-800
  uncertainty: '#fdba74', // orange-300
};

/**
 * Gets a human-readable label for a signal type
 */
function getSignalLabel(signalType: string): string {
  const labels: Record<string, string> = {
    stress: 'Stress',
    engagement: 'Engagement',
    confusion: 'Confusion',
    hesitation: 'Hesitation',
    agreement: 'Agreement',
    disagreement: 'Disagreement',
    disengagement: 'Disengagement',
    confidence: 'Confidence',
    frustration: 'Frustration',
    interest: 'Interest',
    skepticism: 'Skepticism',
    uncertainty: 'Uncertainty',
  };
  return labels[signalType] || signalType;
}

/**
 * Formats duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Timeline visualization component showing confidence score over time and transcript chunks
 */
export default function TimelineReport({ sessionData, className = '' }: TimelineReportProps) {
  const { signals, transcriptChunks = [], startTime, endTime } = sessionData;
  const sessionDuration = endTime ? endTime - startTime : Date.now() - startTime;

  // Normalize timestamps relative to session start
  const normalizedSignals = useMemo(() => 
    signals.map((signal) => ({
      ...signal,
      normalizedTime: signal.timestamp - startTime,
    })),
    [signals, startTime]
  );

  const normalizedChunks = useMemo(() =>
    transcriptChunks.map((chunk) => ({
      ...chunk,
      normalizedTime: chunk.timestamp - startTime,
      normalizedEndTime: chunk.timestamp - startTime + 2000, // Assume 2s duration per chunk
    })),
    [transcriptChunks, startTime]
  );

  // Calculate confidence scores over time
  const confidenceDataPoints = useMemo(() => {
    if (signals.length === 0 || sessionDuration === 0) return [];
    
    const dataPoints: Array<{ time: number; confidence: number }> = [];
    const sampleInterval = Math.max(5000, sessionDuration / 50); // Sample every 5s or 50 points max
    
    for (let time = 0; time <= sessionDuration; time += sampleInterval) {
      // Get all signals up to this point in time
      const signalsUpToTime = normalizedSignals.filter(
        (signal) => signal.normalizedTime <= time
      );
      
      if (signalsUpToTime.length > 0) {
        const confidence = calculateConfidenceScore(signalsUpToTime.map((signal) => ({
          type: signal.type,
          intensity: signal.intensity,
          timestamp: startTime + signal.normalizedTime,
        })));
        
        if (confidence !== null) {
          dataPoints.push({ time, confidence });
        }
      }
    }
    
    return dataPoints;
  }, [signals, sessionDuration, startTime, normalizedSignals]);

  // Calculate position percentage (0-100%)
  const getPositionPercent = (normalizedTime: number): number => {
    if (sessionDuration === 0) return 0;
    return Math.max(0, Math.min(100, (normalizedTime / sessionDuration) * 100));
  };

  // Sort chunks by time for concatenation
  const sortedChunks = useMemo(() => {
    return [...normalizedChunks].sort((a, b) => a.normalizedTime - b.normalizedTime);
  }, [normalizedChunks]);

  // Group signals by time position (within 2% tolerance) to avoid overlap
  // Also deduplicate signals at the exact same timestamp
  const groupedSignals = useMemo(() => {
    // First, deduplicate signals at the exact same timestamp and type
    const uniqueSignalsMap = new Map<string, typeof normalizedSignals[0]>();
    normalizedSignals.forEach((signal) => {
      const key = `${signal.normalizedTime}-${signal.type}`;
      // Keep the signal with highest intensity if duplicates exist
      const existing = uniqueSignalsMap.get(key);
      if (!existing || signal.intensity > existing.intensity) {
        uniqueSignalsMap.set(key, signal);
      }
    });
    const uniqueSignals = Array.from(uniqueSignalsMap.values());
    
    // Then group by position
    const groups: Array<{ x: number; signals: Array<typeof normalizedSignals[0]> }> = [];
    
    uniqueSignals.forEach((signal) => {
      const x = getPositionPercent(signal.normalizedTime);
      // Find existing group within 2% tolerance
      const existingGroup = groups.find((g) => Math.abs(g.x - x) < 2);
      
      if (existingGroup) {
        existingGroup.signals.push(signal);
      } else {
        groups.push({ x, signals: [signal] });
      }
    });
    
    // Sort groups by x position
    return groups.sort((a, b) => a.x - b.x);
  }, [normalizedSignals, sessionDuration]);

  return (
    <div className={`glass-dark rounded-2xl p-4 md:p-6 backdrop-blur-xl border border-white/10 shadow-2xl ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent mb-2">
          Timeline Report
        </h2>
        <p className="text-gray-400 text-sm">
          Session Duration: {formatDuration(sessionDuration)} • {signals.length} Signals • {transcriptChunks.length} Transcript Chunks
        </p>
      </div>

      {/* Timeline Container */}
      <div className="relative w-full">
        {/* Confidence Chart */}
        {confidenceDataPoints.length > 0 && (
          <div className="relative mb-6 bg-black/30 rounded-lg border border-white/10 p-4" style={{ minHeight: '450px' }}>
            <svg
              width="100%"
              height="100%"
              className="absolute inset-0"
              viewBox="0 0 800 450"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Centered title */}
              <text
                x="400"
                y="40"
                fill="rgba(249, 115, 22, 0.9)"
                fontSize="28"
                fontWeight="bold"
                textAnchor="middle"
                className="pointer-events-none"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                Confidence Score
              </text>
              
              {/* Chart area bounds - left margin 60, right margin 40, top margin 70, bottom margin 80 */}
              <rect x="60" y="70" width="700" height="200" fill="none" stroke="none" />
              
              {/* Y-axis grid lines */}
              {[0, 25, 50, 75, 100].map((value) => {
                const y = 270 - (value / 100) * 200; // Map to chart area
                return (
                  <g key={value}>
                    <line
                      x1="60"
                      y1={y}
                      x2="760"
                      y2={y}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                    />
                    <text
                      x="50"
                      y={y + 4}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="11"
                      textAnchor="end"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}
              
              {/* X-axis timeline markers (every 25%) */}
              {[0, 25, 50, 75, 100].map((percent) => {
                const x = 60 + (percent / 100) * 700; // Map to chart area
                return (
                  <g key={percent}>
                    <line
                      x1={x}
                      y1="270"
                      x2={x}
                      y2="280"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y="295"
                      fill="rgba(255,255,255,0.5)"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      {formatDuration((sessionDuration * percent) / 100)}
                    </text>
                  </g>
                );
              })}
              
              {/* X-axis line */}
              <line
                x1="60"
                y1="270"
                x2="760"
                y2="270"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
              />
              
              {/* Y-axis line */}
              <line
                x1="60"
                y1="70"
                x2="60"
                y2="270"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
              />
              
              {/* Confidence line */}
              {confidenceDataPoints.length > 1 && (
                <path
                  d={confidenceDataPoints.map((point, index) => {
                    const x = 60 + (point.time / sessionDuration) * 700;
                    const y = 270 - (point.confidence / 100) * 200;
                    return index === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-shadow-lg"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(249, 115, 22, 0.6))' }}
                />
              )}
              
              {/* Confidence area fill */}
              {confidenceDataPoints.length > 1 && (
                <path
                  d={`M ${60 + (confidenceDataPoints[0].time / sessionDuration) * 700},270 L ${confidenceDataPoints.map((point) => {
                    const x = 60 + (point.time / sessionDuration) * 700;
                    const y = 270 - (point.confidence / 100) * 200;
                    return `${x},${y}`;
                  }).join(' L ')} L ${60 + (confidenceDataPoints[confidenceDataPoints.length - 1].time / sessionDuration) * 700},270 Z`}
                  fill="url(#confidenceGradient)"
                  opacity="0.2"
                />
              )}
              
              {/* Gradient definition */}
              <defs>
                <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              
              {/* Data points */}
              {confidenceDataPoints.map((point, index) => {
                const x = 60 + (point.time / sessionDuration) * 700;
                const y = 270 - (point.confidence / 100) * 200;
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#f97316"
                    stroke="#fff"
                    strokeWidth="1.5"
                    className="hover:r-4 transition-all"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(249, 115, 22, 0.8))' }}
                  />
                );
              })}
              
              {/* Signal markers on chart - grouped to avoid overlap */}
              {groupedSignals.map((group, groupIndex) => {
                const x = 60 + (group.x / 100) * 700; // Map to chart area
                const bulletY = 270; // Bullet on x-axis line
                const labelStartY = bulletY + 20; // Start labels below bullet
                
                // Use the first signal's color for the bullet, or a default
                const primaryColor = SIGNAL_COLORS[group.signals[0].type] || '#f97316';
                
                return (
                  <g key={groupIndex}>
                    {/* Single bullet for the group */}
                    <circle
                      cx={x}
                      cy={bulletY}
                      r="10"
                      fill={primaryColor}
                      stroke="#fff"
                      strokeWidth="2.5"
                      style={{ filter: `drop-shadow(0 0 8px ${primaryColor}80)` }}
                    />
                    {/* Signal labels - stacked vertically below bullet */}
                    {group.signals.map((signal, signalIndex) => {
                      const color = SIGNAL_COLORS[signal.type] || '#f97316';
                      const label = getSignalLabel(signal.type);
                      const labelY = labelStartY + (signalIndex * 28); // Stack labels with spacing
                      return (
                        <g key={signalIndex}>
                          {/* Signal label */}
                          <text
                            x={x}
                            y={labelY}
                            fill={color}
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                          >
                            {label}
                          </text>
                          {/* Intensity value */}
                          <text
                            x={x}
                            y={labelY + 12}
                            fill="rgba(255,255,255,0.7)"
                            fontSize="9"
                            textAnchor="middle"
                            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                          >
                            {Math.round(signal.intensity)}%
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* Transcript Layer - Concatenated and aligned with timeline */}
        {transcriptChunks.length > 0 && (
          <div className="mt-8 mb-4">
            <h3 className="text-sm font-semibold text-orange-400 mb-3">Transcript</h3>
            <div className="glass-dark rounded-lg p-4 border border-orange-500/30 bg-orange-500/10">
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {sortedChunks.map((chunk, index) => (
                  <span key={index} className="inline">
                    {chunk.text}
                    {index < sortedChunks.length - 1 && ' '}
                  </span>
                ))}
              </div>
              {sortedChunks.length > 0 && (
                <div className="mt-3 text-xs text-gray-400">
                  <span>Duration: {formatDuration(sortedChunks[0].normalizedTime)} - {formatDuration(sortedChunks[sortedChunks.length - 1].normalizedEndTime)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signal Type Legend */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <h3 className="text-sm font-semibold text-orange-400 mb-3">Signal Types</h3>
          <div className="flex flex-wrap gap-3">
            {Object.keys(SIGNAL_COLORS)
              .filter((type) => signals.some((s) => s.type === type))
              .map((type) => {
                const color = SIGNAL_COLORS[type];
                const count = signals.filter((s) => s.type === type).length;
                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 glass-dark px-3 py-1.5 rounded-lg border border-white/10"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className="text-xs text-gray-300">{getSignalLabel(type)}</span>
                    <span className="text-xs text-gray-500">({count})</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
