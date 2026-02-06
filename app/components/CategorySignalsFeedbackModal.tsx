'use client';

import { useState } from 'react';
import { BehavioralSignal } from '@/app/lib/types';
import { filterSignalsByTimeRange, getSessionStatistics } from '@/app/lib/signal-aggregator';

const SIGNAL_LABELS: Record<string, string> = {
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

const ALL_SIGNAL_TYPES = [
  'agreement', 'confidence', 'confusion', 'disagreement', 'disengagement',
  'engagement', 'frustration', 'hesitation', 'interest', 'skepticism',
  'stress', 'uncertainty',
] as const;

export type AccuracyChoice = 'yes' | 'partial' | 'no';

export interface CategoryFeedbackData {
  accurate: AccuracyChoice;
  missedSignals: string[];
}

export interface CategorySignalsFeedbackModalProps {
  category: string;
  categoryLabel: string;
  signals: BehavioralSignal[];
  startTime: number;
  endTime: number;
  onSubmit: (data: CategoryFeedbackData) => void;
}

function getSignalLabel(type: string): string {
  return SIGNAL_LABELS[type] || type;
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function CategorySignalsFeedbackModal({
  category,
  categoryLabel,
  signals,
  startTime,
  endTime,
  onSubmit,
}: CategorySignalsFeedbackModalProps) {
  const [accurate, setAccurate] = useState<AccuracyChoice | null>(null);
  const [missedSignals, setMissedSignals] = useState<Set<string>>(new Set());

  const filteredSignals = filterSignalsByTimeRange(signals, startTime, endTime);
  const stats = getSessionStatistics(filteredSignals, startTime, endTime);
  const displayCategoryLabel = categoryLabel || formatCategory(category);

  const toggleMissedSignal = (type: string) => {
    setMissedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSubmit = () => {
    if (accurate === null) return;
    onSubmit({
      accurate,
      missedSignals: Array.from(missedSignals),
    });
  };

  const signalTypesPresent = Object.keys(stats.signalTypeStats).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="glass-dark rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="category-feedback-title"
        aria-modal="true"
      >
        <div className="p-6 space-y-6">
          <h2
            id="category-feedback-title"
            className="text-xl font-bold text-realtalk-blue"
          >
            {displayCategoryLabel} – Signals summary
          </h2>
          <p className="text-sm text-gray-600">
            During the last 5 questions we detected the following behavioural signals. Please tell us how accurate they were and if any were missed.
          </p>

          {/* Signals found */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Signals detected</h3>
            {signalTypesPresent.length > 0 ? (
              <ul className="space-y-2">
                {signalTypesPresent.map((type) => {
                  const s = stats.signalTypeStats[type];
                  if (!s) return null;
                  return (
                    <li
                      key={type}
                      className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2 border border-gray-200/50"
                    >
                      <span className="font-medium text-gray-800">{getSignalLabel(type)}</span>
                      <span className="text-sm text-gray-600">
                        {s.count} occurrence{s.count !== 1 ? 's' : ''} · avg {s.average}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No signals detected in this block.</p>
            )}
          </div>

          {/* Were these accurate? */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Were these signals accurate?</h3>
            <div className="flex flex-wrap gap-2">
              {(['yes', 'partial', 'no'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAccurate(value)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    accurate === value
                      ? 'border-realtalk-blue bg-realtalk-blue/15 text-realtalk-blue'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {value === 'yes' ? 'Yes' : value === 'partial' ? 'Partially' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Signals that may have been missed */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Signals that may have been missed (tick any that apply)</h3>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SIGNAL_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 rounded-lg border border-gray-200/50 bg-white/60 px-3 py-2 cursor-pointer hover:bg-white/80"
                >
                  <input
                    type="checkbox"
                    checked={missedSignals.has(type)}
                    onChange={() => toggleMissedSignal(type)}
                    className="rounded border-gray-400 text-realtalk-blue focus:ring-realtalk-blue"
                  />
                  <span className="text-sm text-gray-800">{getSignalLabel(type)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={accurate === null}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-realtalk-dark to-realtalk-blue text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
