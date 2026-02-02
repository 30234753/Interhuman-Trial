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
 * Signal priority for ordering (lower numbers = higher priority, shown first)
 */
const SIGNAL_PRIORITY: Record<BehavioralSignal['type'], number> = {
  stress: 1,
  engagement: 2,
  confusion: 3,
  frustration: 4,
  hesitation: 5,
  disagreement: 6,
  disengagement: 7,
  uncertainty: 8,
  skepticism: 9,
  agreement: 10,
  interest: 11,
  confidence: 12,
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
  const activeSignals = signals.filter((signal) => signal.intensity >= 1);

  // Sort signals by priority (most important first)
  const sortedSignals = [...activeSignals].sort(
    (a, b) => SIGNAL_PRIORITY[a.type] - SIGNAL_PRIORITY[b.type]
  );

  // If no active signals, don't render anything
  if (sortedSignals.length === 0) {
    return null;
  }

  // Calculate positioning for signals
  // 1-3 signals: horizontal distribution (left, center, right for 3)
  // 4+ signals: stack vertically in rows (3 per row, with vertical spacing)
  const getSignalPosition = (index: number, total: number): { horizontalOffset: number; verticalOffset: number } => {
    if (total === 1) {
      // Single signal: center
      return { horizontalOffset: 0, verticalOffset: 0 };
    } else if (total === 2) {
      // Two signals: left and right
      return { horizontalOffset: index === 0 ? -100 : 100, verticalOffset: 0 };
    } else if (total === 3) {
      // Three signals: left, center, right (increased spacing to prevent overlap)
      const offsets = [-180, 0, 180];
      return { horizontalOffset: offsets[index], verticalOffset: 0 };
    } else {
      // 4+ signals: stack in rows of 3
      const signalsPerRow = 3;
      const rowIndex = Math.floor(index / signalsPerRow);
      const colIndex = index % signalsPerRow;
      const rowSpacing = 60; // Vertical spacing between rows in pixels
      const horizontalOffsets = [-180, 0, 180]; // Left, center, right positions (increased spacing)
      
      return {
        horizontalOffset: horizontalOffsets[colIndex],
        verticalOffset: rowIndex * rowSpacing,
      };
    }
  };

  // Limit signals shown in compact mode
  const signalsToShow = compact ? sortedSignals.slice(0, 6) : sortedSignals;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {signalsToShow.map((signal, index) => {
        const { horizontalOffset, verticalOffset } = getSignalPosition(index, signalsToShow.length);

        return (
          <BehavioralIndicator
            key={`${signal.type}-${signal.timestamp}`}
            signal={signal}
            position="custom"
            customOffset={horizontalOffset}
            customVerticalOffset={verticalOffset}
            size={compact ? 'small' : 'medium'}
            showLabel={showLabels}
            showValue={showValues}
          />
        );
      })}

      {/* Optional: Display a summary indicator above the transcript bar so it doesn't overlap live text */}
      {sortedSignals.length > 0 && (
        <div className="absolute bottom-[7.5rem] left-1/2 -translate-x-1/2 glass-dark px-4 py-2 rounded-full pointer-events-auto border border-gray-300/30 animate-scale-in backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-900 text-xs font-semibold tracking-wide">
              {sortedSignals.length} signal{sortedSignals.length !== 1 ? 's' : ''} active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

