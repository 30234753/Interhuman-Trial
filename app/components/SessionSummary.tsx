'use client';

import { BehavioralSignal } from '@/app/lib/types';
import { getSessionStatistics, SessionStatistics } from '@/app/lib/signal-aggregator';
import { useEffect, useState } from 'react';

export interface SessionSummaryProps {
  signals: BehavioralSignal[];
  startTime: number | null;
  endTime: number;
  isLive?: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Color mapping for different behavioral signal types (orange/black theme)
 */
const SIGNAL_COLORS: Record<string, string> = {
  stress: '#f97316', // orange-500
  engagement: '#ea580c', // orange-600
  confusion: '#fb923c', // orange-400
  hesitation: '#fdba74', // orange-300
  agreement: '#ff8c42', // orange variant
  disagreement: '#c2410c', // orange-800
  disengagement: '#9a3412', // orange-900
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
  };
  return labels[signalType] || signalType;
}

/**
 * Gets insights based on session statistics, focused on confidence
 */
function getBehavioralInsights(stats: SessionStatistics): string[] {
  const insights: string[] = [];

  // Confidence score insights
  if (stats.confidenceScore !== null) {
    if (stats.confidenceScore >= 70) {
      insights.push('High confidence level maintained throughout the session. Strong performance with minimal hesitation or stress.');
    } else if (stats.confidenceScore >= 50) {
      insights.push('Moderate confidence level observed. Some areas for improvement in reducing hesitation or stress.');
    } else if (stats.confidenceScore >= 30) {
      insights.push('Low confidence detected. Focus on building comfort and reducing stress, confusion, and hesitation.');
    } else {
      insights.push('Very low confidence level. Consider taking breaks, simplifying scenarios, or providing more preparation time.');
    }
  }

  // Stress insights (affects confidence)
  if (stats.averageStressScore !== null) {
    if (stats.averageStressScore >= 70) {
      insights.push('High stress levels are impacting confidence. Practice relaxation techniques or adjust roleplay intensity.');
    } else if (stats.averageStressScore >= 40) {
      insights.push('Moderate stress observed. Monitor stress levels to maintain confidence during roleplay.');
    }
  }

  // Hesitation insights (direct confidence indicator)
  const hesitationStats = stats.signalTypeStats['hesitation'];
  if (hesitationStats && hesitationStats.count > stats.totalSignals * 0.3) {
    insights.push('Frequent hesitation detected, indicating uncertainty. More practice or clearer instructions may help build confidence.');
  } else if (hesitationStats && hesitationStats.average >= 60) {
    insights.push('High hesitation levels observed. This suggests a need for more preparation or simplified scenarios.');
  }

  // Confusion insights (affects confidence)
  const confusionStats = stats.signalTypeStats['confusion'];
  if (confusionStats && confusionStats.average >= 50) {
    insights.push('Significant confusion detected, reducing confidence. Clarify instructions or break down complex scenarios.');
  }

  // Engagement insights (positive confidence indicator)
  const engagementStats = stats.signalTypeStats['engagement'];
  if (engagementStats) {
    if (engagementStats.average >= 70) {
      insights.push('Strong engagement maintained, contributing to confidence. Continue building on this positive pattern.');
    } else if (engagementStats.average < 30) {
      insights.push('Low engagement may be affecting confidence. Consider more interactive or relevant roleplay scenarios.');
    }
  }

  // Agreement insights (positive confidence indicator)
  const agreementStats = stats.signalTypeStats['agreement'];
  if (agreementStats && agreementStats.average >= 60) {
    insights.push('High agreement signals indicate good understanding and confidence in responses.');
  }

  // Duration insight
  const durationMinutes = Math.floor(stats.duration / 60000);
  if (durationMinutes > 30) {
    insights.push(`Extended session duration (${durationMinutes} minutes). Monitor for fatigue which may impact confidence.`);
  }

  return insights.length > 0 ? insights : ['Session completed. Continue practicing to build confidence and improve roleplay performance.'];
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
 * Gets confidence level category based on score
 */
function getConfidenceCategory(score: number | null): { label: string; color: string; bgColor: string } {
  if (score === null) {
    return { label: 'No Data', color: 'text-gray-400', bgColor: 'bg-gray-500/20' };
  }
  if (score >= 70) {
    return { label: 'High', color: 'text-orange-300', bgColor: 'bg-orange-600/30' };
  } else if (score >= 50) {
    return { label: 'Moderate', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
  } else if (score >= 30) {
    return { label: 'Low', color: 'text-orange-200', bgColor: 'bg-orange-400/10' };
  } else {
    return { label: 'Very Low', color: 'text-orange-100', bgColor: 'bg-orange-300/10' };
  }
}

/**
 * End-of-session summary component displaying average stress score and behavioral insights
 */
export default function SessionSummary({
  signals,
  startTime,
  endTime,
  isLive = false,
  onClose,
  className = '',
}: SessionSummaryProps) {
  const [stats, setStats] = useState<SessionStatistics | null>(null);
  const hasData = signals.length > 0 && startTime !== null;

  useEffect(() => {
    if (hasData) {
      const sessionStats = getSessionStatistics(signals, startTime!, endTime);
      setStats(sessionStats);
    } else {
      setStats(null);
    }
  }, [signals, startTime, endTime, hasData]);

  const insights = stats ? getBehavioralInsights(stats) : [];
  const confidenceCategory = getConfidenceCategory(stats?.confidenceScore || null);

  return (
    <div className={`glass-dark rounded-2xl p-4 md:p-5 backdrop-blur-xl border border-white/10 shadow-2xl h-full max-h-[calc(100vh-300px)] overflow-y-auto ${className} animate-fade-in-up`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
            Session Summary
            {isLive && (
              <span className="ml-2 text-xs text-orange-400 font-normal">(Live)</span>
            )}
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">
            {startTime ? new Date(startTime).toLocaleTimeString() : 'Not started'} - {hasData && isLive ? 'In progress...' : (startTime ? new Date(endTime).toLocaleTimeString() : 'N/A')}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors duration-200 text-gray-400 hover:text-orange-400"
            aria-label="Close summary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Confidence Score - Prominent Display */}
      <div className="mb-4">
        <div className="glass-dark rounded-xl p-4 border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-black/50">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Confidence Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-bold text-orange-400">
                  {stats?.confidenceScore ?? 'N/A'}
                </span>
                {stats?.confidenceScore != null && (
                  <span className="text-lg text-gray-500">/ 100</span>
                )}
              </div>
              <div className="mt-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${confidenceCategory.bgColor} ${confidenceCategory.color} border border-orange-500/30`}>
                  {confidenceCategory.label} Confidence
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Avg Stress</p>
              <p className="text-2xl font-bold text-orange-500">
                {stats?.averageStressScore !== null && stats?.averageStressScore !== undefined ? stats.averageStressScore : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Session Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="glass-dark rounded-lg p-2.5 border border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Duration</p>
          <p className="text-base font-bold text-orange-400">
            {stats ? formatDuration(stats.duration) : 'N/A'}
          </p>
        </div>
        <div className="glass-dark rounded-lg p-2.5 border border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Signals</p>
          <p className="text-base font-bold text-orange-400">
            {stats ? stats.totalSignals : '0'}
          </p>
        </div>
        <div className="glass-dark rounded-lg p-2.5 border border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Types</p>
          <p className="text-base font-bold text-orange-400">
            {stats ? Object.keys(stats.signalTypeStats).length : '0'}
          </p>
        </div>
        <div className="glass-dark rounded-lg p-2.5 border border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Per Min</p>
          <p className="text-base font-bold text-orange-400">
            {stats && stats.duration > 0 ? Math.round((stats.totalSignals / (stats.duration / 60000)) * 10) / 10 : 'N/A'}
          </p>
        </div>
      </div>

      {/* Signal Type Breakdown */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-orange-400 mb-2">Signal Breakdown</h3>
        {stats && Object.keys(stats.signalTypeStats).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(stats.signalTypeStats)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([signalType, signalStats]) => {
                const color = SIGNAL_COLORS[signalType] || '#f97316';
                const percentage = (signalStats.count / stats.totalSignals) * 100;
                
                return (
                  <div key={signalType} className="glass-dark rounded-lg p-2.5 border border-white/10">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        ></div>
                        <span className="text-sm font-semibold text-white">{getSignalLabel(signalType)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-orange-400">{signalStats.average}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {Math.round(percentage)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="glass-dark rounded-lg p-4 border border-white/10 text-center py-8">
            <p className="text-gray-400 text-sm">No signals detected yet. Start a session to see signal breakdown.</p>
          </div>
        )}
      </div>

      {/* Behavioral Insights */}
      <div>
        <h3 className="text-sm font-semibold text-orange-400 mb-2">Behavioral Insights</h3>
        {insights.length > 0 ? (
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <div
                key={index}
                className="glass-dark rounded-lg p-2.5 border border-orange-500/20 bg-orange-500/5 animate-slide-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed flex-1">{insight}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-dark rounded-lg p-3 border border-white/10 text-center py-4">
            <p className="text-gray-400 text-xs">No insights available yet. Complete a session to see behavioral insights.</p>
          </div>
        )}
      </div>
    </div>
  );
}

