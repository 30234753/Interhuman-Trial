'use client';

import { SessionData, BehavioralSignal, TranscriptChunk } from '@/app/lib/types';
import { useState, useMemo } from 'react';
import { calculateConfidenceScore, getSignalStatistics } from '@/app/lib/signal-aggregator';

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
  
  // State for selected signal type
  const [selectedSignalType, setSelectedSignalType] = useState<string>('all');

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

  // Calculate chart data points over time (confidence or signal intensity based on selection)
  const chartDataPoints = useMemo(() => {
    if (signals.length === 0 || sessionDuration === 0) return [];
    
    const dataPoints: Array<{ time: number; value: number }> = [];
    const sampleInterval = Math.max(5000, sessionDuration / 50); // Sample every 5s or 50 points max
    
    // Find the first occurrence of any signal (for confidence) or selected signal type
    let firstSignalTime: number | null = null;
    if (selectedSignalType === 'all' || !selectedSignalType) {
      // For confidence score, find first signal of any type
      if (normalizedSignals.length > 0) {
        firstSignalTime = Math.min(...normalizedSignals.map(s => s.normalizedTime));
      }
    } else {
      // For specific signal types, find first signal of that type
      const firstSignal = normalizedSignals.find(
        (signal) => signal.type === selectedSignalType
      );
      if (firstSignal) {
        firstSignalTime = firstSignal.normalizedTime;
      }
    }
    
    for (let time = 0; time <= sessionDuration; time += sampleInterval) {
      let value: number | null = null;
      
      if (selectedSignalType === 'all' || !selectedSignalType) {
        // For confidence score, show 0 before first signal, then cumulative confidence
        if (firstSignalTime === null || time < firstSignalTime) {
          // Before the first signal, show 0
          value = 0;
        } else {
          // After first signal, calculate confidence score for all signals up to this point
          const signalsUpToTime = normalizedSignals.filter(
            (signal) => signal.normalizedTime <= time
          );
          
          if (signalsUpToTime.length > 0) {
            const confidence = calculateConfidenceScore(signalsUpToTime.map((signal) => ({
              type: signal.type,
              intensity: signal.intensity,
              timestamp: startTime + signal.normalizedTime,
            })));
            value = confidence;
          } else {
            value = 0;
          }
        }
      } else {
        // For specific signal types, show 0 before first signal, then cumulative average
        if (firstSignalTime === null || time < firstSignalTime) {
          // Before the first signal of this type, show 0
          value = 0;
        } else {
          // After first signal, calculate average intensity of all signals of this type up to this point
          const signalsUpToTime = normalizedSignals.filter(
            (signal) => 
              signal.type === selectedSignalType &&
              signal.normalizedTime <= time
          );
          
          if (signalsUpToTime.length > 0) {
            const sum = signalsUpToTime.reduce((acc, signal) => acc + signal.intensity, 0);
            value = sum / signalsUpToTime.length;
          } else {
            value = 0;
          }
        }
      }
      
      // Always add a data point if we have a value (or 0 for missing signals)
      if (value !== null) {
        dataPoints.push({ time, value });
      }
    }
    
    return dataPoints;
  }, [signals, sessionDuration, startTime, normalizedSignals, selectedSignalType]);

  // Calculate position percentage (0-100%)
  const getPositionPercent = (normalizedTime: number): number => {
    if (sessionDuration === 0) return 0;
    return Math.max(0, Math.min(100, (normalizedTime / sessionDuration) * 100));
  };

  // Sort chunks by time for concatenation
  const sortedChunks = useMemo(() => {
    return [...normalizedChunks].sort((a, b) => a.normalizedTime - b.normalizedTime);
  }, [normalizedChunks]);

  // Calculate main confidence score for the entire session
  const mainConfidenceScore = useMemo(() => {
    return calculateConfidenceScore(signals);
  }, [signals]);

  // Get unique signal types present in the session
  const availableSignalTypes = useMemo(() => {
    const types = new Set(signals.map(s => s.type));
    return Array.from(types).sort();
  }, [signals]);

  // Get statistics for selected signal type
  const selectedSignalStats = useMemo(() => {
    if (selectedSignalType === 'all' || !selectedSignalType) {
      return null;
    }
    return getSignalStatistics(signals, selectedSignalType);
  }, [signals, selectedSignalType]);

  // Filter signals for display based on selection
  const displaySignals = useMemo(() => {
    if (selectedSignalType === 'all' || !selectedSignalType) {
      return normalizedSignals;
    }
    return normalizedSignals.filter(s => s.type === selectedSignalType);
  }, [normalizedSignals, selectedSignalType]);

  // Group signals by time position (within 2% tolerance) to avoid overlap
  // Also deduplicate signals at the exact same timestamp
  const groupedSignals = useMemo(() => {
    // First, deduplicate signals at the exact same timestamp and type
    const uniqueSignalsMap = new Map<string, typeof displaySignals[0]>();
    displaySignals.forEach((signal) => {
      const key = `${signal.normalizedTime}-${signal.type}`;
      // Keep the signal with highest intensity if duplicates exist
      const existing = uniqueSignalsMap.get(key);
      if (!existing || signal.intensity > existing.intensity) {
        uniqueSignalsMap.set(key, signal);
      }
    });
    const uniqueSignals = Array.from(uniqueSignalsMap.values());
    
    // Then group by position
    const groups: Array<{ x: number; signals: Array<typeof displaySignals[0]> }> = [];
    
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
  }, [displaySignals, sessionDuration]);

  return (
    <div className={`glass-dark rounded-2xl p-4 md:p-6 backdrop-blur-xl border border-white/10 shadow-2xl ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent mb-2">
              Timeline Report
            </h2>
            <p className="text-gray-400 text-sm">
              Session Duration: {formatDuration(sessionDuration)} • {signals.length} Signals • {transcriptChunks.length} Transcript Chunks
            </p>
          </div>
          {/* Main Confidence Score */}
          {mainConfidenceScore !== null && (
            <div className="glass-dark rounded-lg px-4 py-3 border border-orange-500/30 bg-orange-500/10">
              <div className="text-xs text-gray-400 mb-1">Overall Confidence Score</div>
              <div className="text-2xl font-bold text-orange-400">{mainConfidenceScore}</div>
            </div>
          )}
        </div>
        
        {/* Signal Type Selector */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <label htmlFor="signal-type-select" className="text-sm font-semibold text-orange-400 whitespace-nowrap">
            Analyze Signal Type:
          </label>
          <select
            id="signal-type-select"
            value={selectedSignalType}
            onChange={(e) => setSelectedSignalType(e.target.value)}
            className="flex-1 px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
          >
            <option value="all">Confidence Score</option>
            {availableSignalTypes.map((type) => {
              const count = signals.filter(s => s.type === type).length;
              return (
                <option key={type} value={type}>
                  {getSignalLabel(type)} ({count})
                </option>
              );
            })}
          </select>
        </div>
        
        {/* Selected Signal Statistics */}
        {selectedSignalType !== 'all' && selectedSignalStats && (
          <div className="mt-4 glass-dark rounded-lg p-4 border border-orange-500/30 bg-orange-500/10">
            <h3 className="text-sm font-semibold text-orange-400 mb-3">
              {getSignalLabel(selectedSignalType)} Analysis
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Count</div>
                <div className="text-lg font-bold text-white">{selectedSignalStats.count}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Average Intensity</div>
                <div className="text-lg font-bold text-orange-400">{selectedSignalStats.average}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Min Intensity</div>
                <div className="text-lg font-bold text-white">{selectedSignalStats.min}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Max Intensity</div>
                <div className="text-lg font-bold text-white">{selectedSignalStats.max}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Container */}
      <div className="relative w-full">
        {/* Chart */}
        {chartDataPoints.length > 0 && (
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
                {selectedSignalType === 'all' || !selectedSignalType
                  ? 'Confidence Score'
                  : `${getSignalLabel(selectedSignalType)} Intensity`}
              </text>
              
              {/* Chart area bounds - left margin 60, right margin 40, top margin 70, bottom margin 80 */}
              <rect x="60" y="70" width="700" height="200" fill="none" stroke="none" />
              
              {/* Gradient definitions */}
              <defs>
                <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
                </linearGradient>
                {availableSignalTypes.map((type) => {
                  const color = SIGNAL_COLORS[type] || '#f97316';
                  return (
                    <linearGradient key={type} id={`signalGradient-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={color} stopOpacity="0.1" />
                    </linearGradient>
                  );
                })}
              </defs>
              
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
              
              {/* Chart line */}
              {chartDataPoints.length > 1 && (() => {
                const lineColor = selectedSignalType === 'all' || !selectedSignalType
                  ? '#f97316'
                  : (SIGNAL_COLORS[selectedSignalType] || '#f97316');
                return (
                  <path
                    d={chartDataPoints.map((point, index) => {
                      const x = 60 + (point.time / sessionDuration) * 700;
                      const y = 270 - (point.value / 100) * 200;
                      return index === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-lg"
                    style={{ filter: `drop-shadow(0 0 4px ${lineColor}80)` }}
                  />
                );
              })()}
              
              {/* Chart area fill */}
              {chartDataPoints.length > 1 && (() => {
                const gradientId = selectedSignalType === 'all' || !selectedSignalType
                  ? 'confidenceGradient'
                  : `signalGradient-${selectedSignalType}`;
                return (
                  <path
                    d={`M ${60 + (chartDataPoints[0].time / sessionDuration) * 700},270 L ${chartDataPoints.map((point) => {
                      const x = 60 + (point.time / sessionDuration) * 700;
                      const y = 270 - (point.value / 100) * 200;
                      return `${x},${y}`;
                    }).join(' L ')} L ${60 + (chartDataPoints[chartDataPoints.length - 1].time / sessionDuration) * 700},270 Z`}
                    fill={`url(#${gradientId})`}
                    opacity="0.2"
                  />
                );
              })()}
              
              {/* Data points */}
              {chartDataPoints.map((point, index) => {
                const x = 60 + (point.time / sessionDuration) * 700;
                const y = 270 - (point.value / 100) * 200;
                const pointColor = selectedSignalType === 'all' || !selectedSignalType
                  ? '#f97316'
                  : (SIGNAL_COLORS[selectedSignalType] || '#f97316');
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3"
                    fill={pointColor}
                    stroke="#fff"
                    strokeWidth="1.5"
                    className="hover:r-4 transition-all"
                    style={{ filter: `drop-shadow(0 0 4px ${pointColor}80)` }}
                  />
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

      </div>
    </div>
  );
}
