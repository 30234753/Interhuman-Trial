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
  sessionId?: string | null;
  /** Optional: number of questions answered (for report view). */
  answersCount?: number;
  /** Optional: average correct for MC questions (0–100 or null). Shown when answersCount > 0. */
  averageCorrect?: number | null;
}

/**
 * Color mapping for different behavioral signal types (distinct color palette)
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
    return { label: 'No Data', color: 'text-gray-500', bgColor: 'bg-gray-200/50' };
  }
  if (score >= 70) {
    return { label: 'High', color: 'text-realtalk-blue', bgColor: 'bg-realtalk-blue/20' };
  } else if (score >= 50) {
    return { label: 'Moderate', color: 'text-realtalk-blue/80', bgColor: 'bg-realtalk-blue/15' };
  } else if (score >= 30) {
    return { label: 'Low', color: 'text-realtalk-blue/60', bgColor: 'bg-realtalk-blue/10' };
  } else {
    return { label: 'Very Low', color: 'text-realtalk-blue/50', bgColor: 'bg-realtalk-blue/5' };
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
  sessionId,
  answersCount,
  averageCorrect,
}: SessionSummaryProps) {
  const [stats, setStats] = useState<SessionStatistics | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const hasData = signals.length > 0 && startTime !== null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    <div className={`glass-dark rounded-2xl p-4 md:p-5 backdrop-blur-xl border border-gray-200 shadow-2xl h-full overflow-y-auto ${className} animate-fade-in-up`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 
            className="text-xl md:text-2xl font-bold bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
            Session Summary
            {isLive && (
              <span className="ml-2 text-xs text-realtalk-blue font-normal">(Live)</span>
            )}
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {isMounted ? (
              <>
                {startTime ? new Date(startTime).toLocaleTimeString() : 'Not started'} - {hasData && isLive ? 'In progress...' : (startTime ? new Date(endTime).toLocaleTimeString() : 'N/A')}
              </>
            ) : (
              'Loading...'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-realtalk-blue/10 rounded-lg transition-colors duration-200 text-gray-500 hover:text-realtalk-blue"
              aria-label="Close summary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Confidence Score - Prominent Display */}
      <div className="mb-4">
        <div className="rounded-xl p-5 border-2 border-realtalk-blue/40 bg-gradient-to-br from-realtalk-blue/20 via-purple-500/15 to-turquoise-500/20 shadow-lg">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-700 uppercase tracking-wider mb-2 font-bold">Confidence Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-realtalk-blue via-purple-600 to-turquoise-500 bg-clip-text">
                  {stats?.confidenceScore ?? 'N/A'}
                </span>
                {stats?.confidenceScore != null && (
                  <span className="text-lg text-gray-600 font-semibold">/ 100</span>
                )}
              </div>
              <div className="mt-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${confidenceCategory.bgColor} ${confidenceCategory.color} border-2 border-realtalk-blue/40 shadow-sm`}>
                  {confidenceCategory.label} Confidence
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg p-3 border-2 border-turquoise-500/30 bg-gradient-to-br from-turquoise-500/15 to-cyan-500/10 shadow-sm">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 font-semibold">Duration</p>
          <p className="text-base font-bold text-turquoise-600">
            {stats ? formatDuration(stats.duration) : 'N/A'}
          </p>
        </div>
        <div className="rounded-lg p-3 border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/15 to-pink-500/10 shadow-sm">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 font-semibold">Signals</p>
          <p className="text-base font-bold text-purple-600">
            {stats ? stats.totalSignals : '0'}
          </p>
        </div>
        {answersCount !== undefined && answersCount > 0 && (
          <>
            <div className="rounded-lg p-3 border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-orange-500/10 shadow-sm">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 font-semibold">Questions</p>
              <p className="text-base font-bold text-amber-600">{answersCount}</p>
            </div>
            <div className="rounded-lg p-3 border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 shadow-sm">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 font-semibold">MC correct</p>
              <p className="text-base font-bold text-emerald-600">
                {averageCorrect !== undefined && averageCorrect !== null ? `${Math.round(averageCorrect)}%` : 'N/A'}
              </p>
            </div>
          </>
        )}
        <div className="rounded-lg p-3 border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/15 to-indigo-500/10 shadow-sm">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 font-semibold">Types</p>
          <p className="text-base font-bold text-blue-600">
            {stats ? Object.keys(stats.signalTypeStats).length : '0'}
          </p>
        </div>
        <div className="rounded-lg p-3 border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 shadow-sm">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-1 font-semibold">Per Min</p>
          <p className="text-base font-bold text-emerald-600">
            {stats && stats.duration > 0 ? Math.round((stats.totalSignals / (stats.duration / 60000)) * 10) / 10 : 'N/A'}
          </p>
        </div>
      </div>

      {/* Signal Type Breakdown */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-realtalk-blue mb-2">Signal Breakdown</h3>
        {stats && Object.keys(stats.signalTypeStats).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(stats.signalTypeStats)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([signalType, signalStats]) => {
                const color = SIGNAL_COLORS[signalType] || '#6164F0';
                const percentage = (signalStats.count / stats.totalSignals) * 100;
                
                return (
                  <div key={signalType} className="rounded-lg p-3 border-2 border-gray-200/50 bg-gradient-to-r from-white/80 to-gray-50/50 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{ backgroundColor: color }}
                        ></div>
                        <span className="text-sm font-bold" style={{ color: color }}>{getSignalLabel(signalType)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold" style={{ color: color }}>{signalStats.average}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full rounded-full transition-all duration-500 shadow-sm"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-12 text-right font-semibold">
                        {Math.round(percentage)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="glass-dark rounded-lg p-4 border border-gray-200 text-center py-8">
            <p className="text-gray-500 text-sm">No signals detected yet. Start a session to see signal breakdown.</p>
          </div>
        )}
      </div>

      {/* Behavioral Insights */}
      <div>
        <h3 className="text-sm font-semibold text-realtalk-blue mb-2">Behavioral Insights</h3>
        {insights.length > 0 ? (
          <div className="space-y-2">
            {insights.map((insight, index) => {
              const colors = [
                'from-amber-500/20 to-orange-500/10 border-amber-500/30',
                'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
                'from-purple-500/20 to-pink-500/10 border-purple-500/30',
                'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
              ];
              const colorClass = colors[index % colors.length];
              return (
                <div
                  key={index}
                  className={`rounded-lg p-3 border-2 bg-gradient-to-r ${colorClass} animate-slide-in shadow-sm`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <svg className="w-5 h-5 text-realtalk-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-gray-800 text-xs leading-relaxed flex-1 font-medium">{insight}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-dark rounded-lg p-3 border border-gray-200 text-center py-8">
            <p className="text-gray-500 text-sm">No insights available yet. Complete a session to see behavioral insights.</p>
          </div>
        )}
      </div>
    </div>
  );
}

