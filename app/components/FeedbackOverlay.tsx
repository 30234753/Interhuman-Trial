'use client';

import { BehavioralSignal } from '@/app/lib/types';
import BehavioralIndicator from './BehavioralIndicator';

export interface FeedbackOverlayProps {
  signals: BehavioralSignal[];
  className?: string;
  showLabels?: boolean;
  showValues?: boolean;
  compact?: boolean;
}

/**
 * Position mapping for different signal types
 * Distributes signals around the video feed to avoid overlap
 */
const SIGNAL_POSITIONS: Record<BehavioralSignal['type'], BehavioralIndicator['position']> = {
  stress: 'top-left',
  engagement: 'top-right',
  confusion: 'bottom-left',
  hesitation: 'bottom-right',
  agreement: 'top',
  disagreement: 'bottom',
};

/**
 * Signal priority for ordering (higher priority signals shown first)
 */
const SIGNAL_PRIORITY: Record<BehavioralSignal['type'], number> = {
  stress: 1,
  engagement: 2,
  confusion: 3,
  hesitation: 4,
  agreement: 5,
  disagreement: 6,
};

/**
 * Feedback overlay component that displays behavioral signals on video feed in real-time
 * Shows unified color-coded indicators with intensity levels for all behavioral signals
 */
export default function FeedbackOverlay({
  signals,
  className = '',
  showLabels = false,
  showValues = false,
  compact = true,
}: FeedbackOverlayProps) {
  // Filter out signals with zero intensity to reduce clutter
  const activeSignals = signals.filter((signal) => signal.intensity > 0);

  // Sort signals by priority (most important first)
  const sortedSignals = [...activeSignals].sort(
    (a, b) => SIGNAL_PRIORITY[a.type] - SIGNAL_PRIORITY[b.type]
  );

  // If no active signals, don't render anything
  if (sortedSignals.length === 0) {
    return null;
  }

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {sortedSignals.map((signal, index) => {
        // For compact mode, only show top 4 signals to avoid clutter
        if (compact && index >= 4) {
          return null;
        }

        return (
          <BehavioralIndicator
            key={`${signal.type}-${signal.timestamp}`}
            signal={signal}
            position={SIGNAL_POSITIONS[signal.type]}
            size={compact ? 'small' : 'medium'}
            showLabel={showLabels}
            showValue={showValues}
          />
        );
      })}

      {/* Optional: Display a summary indicator showing overall state */}
      {sortedSignals.length > 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 px-3 py-1 rounded-full pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-medium">
              {sortedSignals.length} signal{sortedSignals.length !== 1 ? 's' : ''} active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

