'use client';

import { SessionData, BehavioralSignal, TranscriptChunk, SessionAnswer } from '@/app/lib/types';
import { useState, useMemo } from 'react';
import { calculateConfidenceScore, getSignalStatistics } from '@/app/lib/signal-aggregator';
import { RADAR_SCENARIOS, getScenarioById, getRadarScores } from '@/app/lib/radar-attributes';
import EmotionalRadarChart from '@/app/components/EmotionalRadarChart';

export interface TimelineReportProps {
  sessionData: SessionData;
  className?: string;
  /** Main positives of the experience (feedback section) */
  positives?: string | null;
  onPositivesChange?: (value: string) => void;
  /** Main negatives of the experience (feedback section) */
  negatives?: string | null;
  onNegativesChange?: (value: string) => void;
  rating?: number | null;
  feedback?: string | null;
  /** 1–5 rating: how effective the system was at adapting questions to signals */
  adaptationRating?: number | null;
  onAdaptationRatingChange?: (rating: number | null) => void;
  onRatingChange?: (rating: number | null) => void;
  onFeedbackChange?: (feedback: string) => void;
  onSubmit?: () => void;
  onEdit?: () => void;
  isSubmitting?: boolean;
  isLocked?: boolean;
}

/**
 * Color mapping for different behavioral signal types (distinct color palette)
 * Matching SessionSummary component
 */
const SIGNAL_COLORS: Record<string, string> = {
  stress: '#ef4444', // red-500 - stress/negative
  engagement: '#06b6d4', // turquoise-500 - positive engagement
  confusion: '#f59e0b', // amber-500 - confusion/warning
  hesitation: '#8b5cf6', // purple-500 - hesitation/uncertainty
  agreement: '#10b981', // emerald-500 - positive agreement
  disagreement: '#f97316', // orange-500 - disagreement
  disengagement: '#6b7280', // gray-500 - neutral disengagement
  confidence: '#3b82f6', // blue-500 - confidence/positive
  frustration: '#dc2626', // red-600 - frustration/negative
  interest: '#eab308', // yellow-500 - interest/curiosity (distinct from engagement)
  skepticism: '#a855f7', // purple-500 - skepticism
  uncertainty: '#14b8a6', // teal-500 - uncertainty (distinct from engagement/interest)
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
export default function TimelineReport({ 
  sessionData, 
  className = '',
  positives: externalPositives,
  onPositivesChange,
  negatives: externalNegatives,
  onNegativesChange,
  rating: externalRating,
  feedback: externalFeedback,
  adaptationRating: externalAdaptationRating,
  onAdaptationRatingChange,
  onRatingChange,
  onFeedbackChange,
  onSubmit,
  onEdit,
  isSubmitting = false,
  isLocked = false,
}: TimelineReportProps) {
  const { signals, transcriptChunks = [], answers = [], startTime, endTime } = sessionData;
  const sessionDuration = endTime ? endTime - startTime : Date.now() - startTime;
  
  // State for selected signal types (multi-select: 'all' = Confidence Score, or signal type strings)
  const [selectedSignalTypes, setSelectedSignalTypes] = useState<Set<string>>(new Set(['all']));
  
  const toggleSignalType = (key: string) => {
    setSelectedSignalTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Ensure at least one remains
        if (next.size === 0) next.add('all');
      } else {
        next.add(key);
      }
      return next;
    });
  };
  // State for radar scenario (which 5 attributes to show)
  const [radarScenarioId, setRadarScenarioId] = useState<string>(RADAR_SCENARIOS[0]?.id ?? 'general');
  // Carousel: current answer card index (Answers & signals per question)
  const [answerCardIndex, setAnswerCardIndex] = useState(0);
  
  // Internal state for positives, negatives, rating, feedback, adaptation rating (used if not controlled externally)
  const [internalPositives, setInternalPositives] = useState<string>(externalPositives ?? '');
  const [internalNegatives, setInternalNegatives] = useState<string>(externalNegatives ?? '');
  const [internalRating, setInternalRating] = useState<number | null>(externalRating ?? null);
  const [internalFeedback, setInternalFeedback] = useState<string>(externalFeedback ?? '');
  const [internalAdaptationRating, setInternalAdaptationRating] = useState<number | null>(externalAdaptationRating ?? null);

  const positives = externalPositives !== undefined ? (externalPositives ?? '') : internalPositives;
  const negatives = externalNegatives !== undefined ? (externalNegatives ?? '') : internalNegatives;
  const rating = externalRating !== undefined ? externalRating : internalRating;
  const feedback = externalFeedback !== undefined ? (externalFeedback ?? '') : internalFeedback;
  const adaptationRating = externalAdaptationRating !== undefined ? externalAdaptationRating : internalAdaptationRating;

  const handlePositivesChange = (value: string) => {
    if (onPositivesChange) {
      onPositivesChange(value);
    } else {
      setInternalPositives(value);
    }
  };

  const handleNegativesChange = (value: string) => {
    if (onNegativesChange) {
      onNegativesChange(value);
    } else {
      setInternalNegatives(value);
    }
  };

  const handleRatingClick = (value: number) => {
    const newRating = rating === value ? null : value;
    if (onRatingChange) {
      onRatingChange(newRating);
    } else {
      setInternalRating(newRating);
    }
  };

  const handleAdaptationRatingClick = (value: number) => {
    const newRating = adaptationRating === value ? null : value;
    if (onAdaptationRatingChange) {
      onAdaptationRatingChange(newRating);
    } else {
      setInternalAdaptationRating(newRating);
    }
  };

  const handleFeedbackChange = (value: string) => {
    if (onFeedbackChange) {
      onFeedbackChange(value);
    } else {
      setInternalFeedback(value);
    }
  };

  // Normalize timestamps relative to session start
  const normalizedSignals = useMemo(() => 
    signals.map((signal) => ({
      ...signal,
      normalizedTime: signal.timestamp - startTime,
    })),
    [signals, startTime]
  );

  // Build chart series: one entry per selected type (confidence and/or signal types)
  type ChartSeries = { seriesKey: string; label: string; color: string; dataPoints: Array<{ time: number; value: number }> };
  const chartSeries = useMemo((): ChartSeries[] => {
    if (signals.length === 0 || sessionDuration === 0 || selectedSignalTypes.size === 0) return [];
    
    const sampleInterval = Math.max(5000, sessionDuration / 50);
    const timePoints: number[] = [];
    for (let time = 0; time <= sessionDuration; time += sampleInterval) {
      timePoints.push(time);
    }
    
    const firstSignalTimeAny = normalizedSignals.length > 0
      ? Math.min(...normalizedSignals.map(s => s.normalizedTime))
      : null;
    
    const series: ChartSeries[] = [];
    
    if (selectedSignalTypes.has('all')) {
      const dataPoints = timePoints.map((time) => {
        if (firstSignalTimeAny === null || time < firstSignalTimeAny) return { time, value: 0 };
        const signalsUpToTime = normalizedSignals.filter((s) => s.normalizedTime <= time);
        const confidence = signalsUpToTime.length > 0
          ? (calculateConfidenceScore(signalsUpToTime.map((s) => ({
              type: s.type,
              intensity: s.intensity,
              timestamp: startTime + s.normalizedTime,
            }))) ?? 0)
          : 0;
        return { time, value: confidence };
      });
      series.push({
        seriesKey: 'all',
        label: 'Confidence Score',
        color: '#6164F0',
        dataPoints,
      });
    }
    
    const availableTypes = Array.from(new Set(signals.map((s) => s.type))).sort();
    availableTypes.forEach((signalType) => {
      if (!selectedSignalTypes.has(signalType)) return;
      const firstSignal = normalizedSignals.find((s) => s.type === signalType);
      const firstSignalTime = firstSignal?.normalizedTime ?? null;
      const dataPoints = timePoints.map((time) => {
        if (firstSignalTime === null || time < firstSignalTime) return { time, value: 0 };
        const signalsUpToTime = normalizedSignals.filter(
          (s) => s.type === signalType && s.normalizedTime <= time
        );
        const avg = signalsUpToTime.length > 0
          ? signalsUpToTime.reduce((acc, s) => acc + s.intensity, 0) / signalsUpToTime.length
          : 0;
        return { time, value: avg };
      });
      series.push({
        seriesKey: signalType,
        label: getSignalLabel(signalType),
        color: SIGNAL_COLORS[signalType] || '#6164F0',
        dataPoints,
      });
    });
    
    return series;
  }, [signals, sessionDuration, startTime, normalizedSignals, selectedSignalTypes]);

  // Flat list of all data points for backward-compat checks (e.g. "has any line to show")
  const hasAnyChartData = chartSeries.some((s) => s.dataPoints.length > 1);

  // Calculate position percentage (0-100%)
  const getPositionPercent = (normalizedTime: number): number => {
    if (sessionDuration === 0) return 0;
    return Math.max(0, Math.min(100, (normalizedTime / sessionDuration) * 100));
  };

  // Calculate main confidence score for the entire session
  const mainConfidenceScore = useMemo(() => {
    return calculateConfidenceScore(signals);
  }, [signals]);

  // Get unique signal types present in the session
  const availableSignalTypes = useMemo(() => {
    const types = new Set(signals.map(s => s.type));
    return Array.from(types).sort();
  }, [signals]);

  // Get statistics for each selected signal type (excluding 'all')
  const selectedSignalStatsList = useMemo(() => {
    return Array.from(selectedSignalTypes)
      .filter((key) => key !== 'all')
      .map((signalType) => ({
        signalType,
        stats: getSignalStatistics(signals, signalType),
      }))
      .filter((entry) => entry.stats != null) as Array<{ signalType: string; stats: NonNullable<ReturnType<typeof getSignalStatistics>> }>;
  }, [signals, selectedSignalTypes]);

  // Filter signals for display based on selection (all selected types)
  const displaySignals = useMemo(() => {
    if (selectedSignalTypes.has('all') && selectedSignalTypes.size === 1) {
      return normalizedSignals;
    }
    return normalizedSignals.filter((s) => selectedSignalTypes.has(s.type));
  }, [normalizedSignals, selectedSignalTypes]);

  // Radar chart: 5 emotional attributes for selected scenario
  const radarScenario = useMemo(
    () => getScenarioById(radarScenarioId) ?? RADAR_SCENARIOS[0],
    [radarScenarioId]
  );
  const radarData = useMemo(
    () => getRadarScores(signals, radarScenario),
    [signals, radarScenario]
  );

  // Per-question answers with signals and transcript in each answer window
  const answersWithSignals = useMemo(() => {
    return answers.map((answer: SessionAnswer) => {
      const signalsInWindow = signals.filter(
        (s) => s.timestamp >= answer.startTime && s.timestamp <= answer.endTime
      );
      const chunksInWindow = transcriptChunks
        .filter(
          (c) => c.timestamp >= answer.startTime && c.timestamp <= answer.endTime
        )
        .sort((a, b) => a.chunkOrder - b.chunkOrder);
      const transcriptInWindow = chunksInWindow.map((c) => c.text).join(' ').trim() || null;
      return { answer, signalsInWindow, transcriptInWindow };
    });
  }, [answers, signals, transcriptChunks]);

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
            <h2 
              className="text-xl md:text-2xl font-bold bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent mb-2"
              style={{
                backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}>
              Timeline Report
            </h2>
            <p className="text-gray-700 text-sm">
              Session Duration: {formatDuration(sessionDuration)} • {signals.length} Signals • {transcriptChunks.length} Transcript Chunks
            </p>
          </div>
          {/* Main Confidence Score */}
          {mainConfidenceScore !== null && (
            <div className="rounded-lg px-4 py-3 border-2 border-realtalk-blue/40 bg-gradient-to-br from-realtalk-blue/20 via-purple-500/15 to-turquoise-500/20 shadow-lg">
              <div className="text-xs text-gray-700 font-semibold mb-1 uppercase tracking-wide">Overall Confidence Score</div>
              <div className="text-2xl font-bold bg-gradient-to-r from-realtalk-blue to-purple-600 bg-clip-text">{mainConfidenceScore}</div>
            </div>
          )}
        </div>
        
        {/* Signal Type Multi-Select Checkboxes */}
        <div className="mt-4">
          <div className="text-sm font-semibold text-realtalk-blue mb-2">Compare on chart:</div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedSignalTypes.has('all')}
                onChange={() => toggleSignalType('all')}
                className="w-4 h-4 rounded border-2 border-realtalk-blue/50 text-realtalk-blue focus:ring-realtalk-blue/30"
              />
              <span className="text-sm font-medium text-gray-700">Confidence Score</span>
            </label>
            {availableSignalTypes.map((type) => {
              const count = signals.filter((s) => s.type === type).length;
              const color = SIGNAL_COLORS[type] || '#6164F0';
              return (
                <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedSignalTypes.has(type)}
                    onChange={() => toggleSignalType(type)}
                    className="w-4 h-4 rounded border-2 border-gray-300 focus:ring-realtalk-blue/30"
                  />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
                  <span className="text-sm font-medium text-gray-700">
                    {getSignalLabel(type)} ({count})
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        
        {/* Selected Signal Statistics (for each selected type except Confidence) */}
        {selectedSignalStatsList.length > 0 && (
          <div className="mt-4 rounded-lg p-4 border-2 border-realtalk-blue/40 bg-gradient-to-br from-realtalk-blue/15 via-purple-500/10 to-turquoise-500/15 shadow-lg">
            <h3 className="text-sm font-semibold text-realtalk-blue mb-3">Signal stats</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedSignalStatsList.map(({ signalType, stats }) => {
                const signalColor = SIGNAL_COLORS[signalType] || '#6164F0';
                return (
                  <div key={signalType} className="bg-white/60 rounded-lg p-3 border border-gray-200/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: signalColor }} />
                      <span className="text-sm font-semibold" style={{ color: signalColor }}>{getSignalLabel(signalType)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-600">Count</span> <span className="font-bold">{stats.count}</span></div>
                      <div><span className="text-gray-600">Avg</span> <span className="font-bold">{stats.average}%</span></div>
                      <div><span className="text-gray-600">Min</span> <span className="font-bold">{stats.min}%</span></div>
                      <div><span className="text-gray-600">Max</span> <span className="font-bold">{stats.max}%</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      

      {/* Timeline Container */}
      <div className="relative w-full">
        {/* Chart */}
        {hasAnyChartData && (
          <div className="relative mb-6 bg-gradient-to-br from-gray-100 via-white to-gray-50 rounded-lg border-2 border-gray-300 shadow-inner p-4" style={{ minHeight: '450px' }}>
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
                fill="#6164F0"
                fontSize="28"
                fontWeight="bold"
                textAnchor="middle"
                className="pointer-events-none"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {chartSeries.length === 1
                  ? chartSeries[0].label + (chartSeries[0].seriesKey === 'all' ? '' : ' Intensity')
                  : 'Compare signals'}
              </text>
              
              {/* Chart area bounds - left margin 60, right margin 40, top margin 70, bottom margin 80 */}
              <rect x="60" y="70" width="700" height="200" fill="none" stroke="none" />
              
              {/* Gradient definitions */}
              <defs>
                <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#6164F0" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6164F0" stopOpacity="0.1" />
                </linearGradient>
                {availableSignalTypes.map((type) => {
                  const color = SIGNAL_COLORS[type] || '#6164F0';
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
                      fill="rgba(97, 100, 240, 0.9)"
                      fontSize="11"
                      textAnchor="end"
                      fontWeight="500"
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
                      fill="rgba(97, 100, 240, 0.9)"
                      fontSize="11"
                      textAnchor="middle"
                      fontWeight="500"
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
              
              {/* Chart lines (one per series) */}
              {chartSeries.map((series) => {
                if (series.dataPoints.length < 2) return null;
                const strokeWidth = chartSeries.length > 3 ? 2 : 2.5;
                const r = chartSeries.length > 4 ? 2 : 3;
                return (
                  <g key={series.seriesKey}>
                    <path
                      d={series.dataPoints.map((point, index) => {
                        const x = 60 + (point.time / sessionDuration) * 700;
                        const y = 270 - (point.value / 100) * 200;
                        return index === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke={series.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-sm"
                      style={{ filter: `drop-shadow(0 0 2px ${series.color}80)` }}
                    />
                    {series.dataPoints.map((point, index) => {
                      const x = 60 + (point.time / sessionDuration) * 700;
                      const y = 270 - (point.value / 100) * 200;
                      return (
                        <circle
                          key={`${series.seriesKey}-${index}`}
                          cx={x}
                          cy={y}
                          r={r}
                          fill={series.color}
                          stroke="#fff"
                          strokeWidth="1"
                          className="transition-all"
                          style={{ filter: `drop-shadow(0 0 2px ${series.color}80)` }}
                        />
                      );
                    })}
                  </g>
                );
              })}
              
            </svg>
            {/* Legend */}
            {chartSeries.length > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-4 px-4 py-2 rounded-lg bg-white/80 border border-gray-200/80 shadow-sm">
                {chartSeries.map((series) => (
                  <div key={series.seriesKey} className="flex items-center gap-2">
                    <div
                      className="w-3 h-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: series.color, minWidth: 16 }}
                    />
                    <span className="text-xs font-medium text-gray-700">{series.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Answers & signals per question – carousel */}
        {answersWithSignals.length > 0 && (
          <div className="mt-8 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="text-lg font-semibold text-realtalk-blue">Answers & signals per question</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAnswerCardIndex((i) => Math.max(0, i - 1))}
                  disabled={answerCardIndex === 0}
                  className="p-2 rounded-lg border-2 border-realtalk-blue/40 bg-white/80 hover:bg-realtalk-blue/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous question"
                >
                  <svg className="w-5 h-5 text-realtalk-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  Question {answerCardIndex + 1} of {answersWithSignals.length}
                </span>
                <button
                  type="button"
                  onClick={() => setAnswerCardIndex((i) => Math.min(answersWithSignals.length - 1, i + 1))}
                  disabled={answerCardIndex === answersWithSignals.length - 1}
                  className="p-2 rounded-lg border-2 border-realtalk-blue/40 bg-white/80 hover:bg-realtalk-blue/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next question"
                >
                  <svg className="w-5 h-5 text-realtalk-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-[200px]">
              {(() => {
                const safeIndex = Math.min(answerCardIndex, answersWithSignals.length - 1);
                const { answer, signalsInWindow, transcriptInWindow } = answersWithSignals[safeIndex];
                const index = safeIndex;
                return (
                  <div
                    key={`${answer.questionId}-${answer.startTime}`}
                    className="rounded-lg p-4 border-2 border-realtalk-blue/30 bg-gradient-to-br from-realtalk-blue/10 via-purple-500/5 to-turquoise-500/10 shadow-sm"
                  >
                    <div className="mb-2">
                      <span className="text-xs font-semibold text-realtalk-blue uppercase tracking-wide">Question {index + 1}</span>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{answer.questionText}</p>
                    </div>
                    <div className="mb-2 text-sm">
                      <span className="text-gray-600">What you said: </span>
                      <span className="font-medium text-realtalk-blue">
                        {transcriptInWindow || answer.spokenAnswer || '(no transcript)'}
                      </span>
                    </div>
                    {answer.correct !== null && (
                      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                        <span className="text-gray-600">Selected:</span>
                        <span className="font-medium text-realtalk-blue">{answer.spokenAnswer || '—'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${answer.correct ? 'bg-emerald-500/20 text-emerald-700' : 'bg-red-500/20 text-red-700'}`}>
                          {answer.correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="text-xs text-gray-600">Signals in answer window ({signalsInWindow.length}):</span>
                      {signalsInWindow.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {signalsInWindow.slice(0, 12).map((s, i) => (
                            <span
                              key={`${s.timestamp}-${s.type}-${i}`}
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border border-gray-200/80 bg-white/60"
                              style={{ borderLeftColor: SIGNAL_COLORS[s.type] || '#6164F0', borderLeftWidth: 3 }}
                            >
                              {getSignalLabel(s.type)} {s.intensity}%
                            </span>
                          ))}
                          {signalsInWindow.length > 12 && (
                            <span className="text-xs text-gray-500">+{signalsInWindow.length - 12} more</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic mt-0.5">No signals in this window</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>
      
{/* Emotional attributes radar chart – 5 configurable attributes by scenario */}
<div className="mb-8 rounded-xl border-2 border-realtalk-blue/30 bg-gradient-to-br from-realtalk-blue/10 via-purple-500/5 to-turquoise-500/10 p-4 md:p-6 shadow-lg">
        <h3 
          className="text-lg md:text-xl font-bold mb-2 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}>
          Emotional attributes
        </h3>
        <p className="text-sm text-gray-600 mb-4 max-w-2xl">
          These five attributes are one lens on your communication. Successful communication looks different in different contexts and for different communicators—choose the scenario that fits your situation.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
          <label htmlFor="radar-scenario-select" className="text-sm font-semibold text-realtalk-blue whitespace-nowrap">
            Scenario:
          </label>
          <select
            id="radar-scenario-select"
            value={radarScenarioId}
            onChange={(e) => setRadarScenarioId(e.target.value)}
            className="flex-1 min-w-0 px-4 py-2.5 bg-gradient-to-r from-realtalk-blue/10 to-purple-500/10 border-2 border-realtalk-blue/30 rounded-lg text-realtalk-blue font-semibold placeholder-gray-400 focus:outline-none focus:border-realtalk-blue focus:ring-2 focus:ring-realtalk-blue/30"
          >
            {RADAR_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-center">
          <EmotionalRadarChart
            data={radarData}
            size={320}
            className="max-w-full"
            fillColor="#6164F0"
            strokeColor="#5442b3"
          />
        </div>
      </div>

      {/* Rating and Feedback Section */}
      <div className="mt-8 pt-6 border-t border-gray-200/50">
        <h3 className="text-lg font-semibold text-realtalk-blue mb-4">Feedback</h3>

        {/* Positives */}
        <div className="mb-6">
          <label htmlFor="positives-input" className="block text-sm font-medium text-gray-700 mb-3">
            Positives
          </label>
          <textarea
            id="positives-input"
            value={positives || ''}
            onChange={(e) => !isLocked && handlePositivesChange(e.target.value)}
            disabled={isLocked}
            placeholder="What were the main positives of this experience?"
            rows={3}
            className={`w-full px-4 py-3 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-300 rounded-lg text-realtalk-blue font-medium placeholder-gray-400 transition-all shadow-sm resize-none ${
              isLocked
                ? 'cursor-not-allowed opacity-60'
                : 'hover:border-realtalk-blue/40 focus:border-realtalk-blue focus:outline-none focus:ring-2 focus:ring-realtalk-blue/30'
            }`}
          />
        </div>

        {/* Negatives */}
        <div className="mb-6">
          <label htmlFor="negatives-input" className="block text-sm font-medium text-gray-700 mb-3">
            Negatives
          </label>
          <textarea
            id="negatives-input"
            value={negatives || ''}
            onChange={(e) => !isLocked && handleNegativesChange(e.target.value)}
            disabled={isLocked}
            placeholder="What were the main negatives of this experience?"
            rows={3}
            className={`w-full px-4 py-3 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-300 rounded-lg text-realtalk-blue font-medium placeholder-gray-400 transition-all shadow-sm resize-none ${
              isLocked
                ? 'cursor-not-allowed opacity-60'
                : 'hover:border-realtalk-blue/40 focus:border-realtalk-blue focus:outline-none focus:ring-2 focus:ring-realtalk-blue/30'
            }`}
          />
        </div>

        {/* Star Rating - Accuracy */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How accurate was the system? (1-5)
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => !isLocked && handleRatingClick(value)}
                disabled={isLocked}
                className={`transition-all transform ${
                  isLocked ? 'cursor-not-allowed opacity-60' : 'hover:scale-110 cursor-pointer'
                } ${
                  rating && rating >= value
                    ? 'text-yellow-400'
                    : 'text-gray-300 hover:text-yellow-300'
                }`}
                aria-label={`Rate ${value} out of 5`}
              >
                <svg
                  className="w-10 h-10"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
            {rating && (
              <span className="ml-3 text-sm font-semibold text-realtalk-blue">
                {rating} / 5
              </span>
            )}
          </div>
        </div>

        {/* Adaptation effectiveness rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How effective was the system at adapting questions to your signals? (1–5)
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => !isLocked && handleAdaptationRatingClick(value)}
                disabled={isLocked}
                className={`transition-all transform ${
                  isLocked ? 'cursor-not-allowed opacity-60' : 'hover:scale-110 cursor-pointer'
                } ${
                  adaptationRating !== null && adaptationRating >= value
                    ? 'text-amber-500'
                    : 'text-gray-300 hover:text-amber-400'
                }`}
                aria-label={`Rate adaptation ${value} out of 5`}
              >
                <svg
                  className="w-10 h-10"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
            {adaptationRating !== null && (
              <span className="ml-3 text-sm font-semibold text-realtalk-blue">
                {adaptationRating} / 5
              </span>
            )}
          </div>
        </div>

        {/* Feedback Text Box */}
        <div className="mb-6">
          <label htmlFor="feedback-input" className="block text-sm font-medium text-gray-700 mb-3">
            Feedback (Optional)
          </label>
          <textarea
            id="feedback-input"
            value={feedback || ''}
            onChange={(e) => !isLocked && handleFeedbackChange(e.target.value)}
            disabled={isLocked}
            placeholder="Share your thoughts about the system's accuracy..."
            rows={4}
            className={`w-full px-4 py-3 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-300 rounded-lg text-realtalk-blue font-medium placeholder-gray-400 transition-all shadow-sm resize-none ${
              isLocked 
                ? 'cursor-not-allowed opacity-60' 
                : 'hover:border-realtalk-blue/40 focus:border-realtalk-blue focus:outline-none focus:ring-2 focus:ring-realtalk-blue/30'
            }`}
          />
        </div>

        {/* Submit/Edit Button Bar */}
        <div className="flex items-center justify-end pt-4 border-t border-gray-200/50">
          {isLocked ? (
            <button
              type="button"
              onClick={onEdit}
              className="px-6 py-3 bg-gradient-to-r from-realtalk-blue/30 to-purple-500/30 hover:from-realtalk-blue/40 hover:to-purple-500/40 border-2 border-realtalk-blue/40 rounded-lg text-realtalk-blue font-bold hover:text-purple-700 transition-all shadow-md hover:shadow-lg"
            >
              Edit feedback
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-purple-600 hover:from-realtalk-blue hover:via-purple-500 hover:to-pink-500 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit feedback'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
