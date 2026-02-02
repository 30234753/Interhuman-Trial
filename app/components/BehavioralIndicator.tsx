'use client';

import { BehavioralSignal } from '@/app/lib/types';

export interface BehavioralIndicatorProps {
  signal: BehavioralSignal;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showValue?: boolean;
  customOffset?: number; // Horizontal offset from center in pixels (for custom positioning)
  customVerticalOffset?: number; // Vertical offset from bottom in pixels (for custom positioning)
}

/**
 * Color mapping for different behavioral signal types (distinct color palette)
 */
const SIGNAL_COLORS: Record<BehavioralSignal['type'], string> = {
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
 * Gets the intensity level (low, medium, high) based on intensity value
 */
function getIntensityLevel(intensity: number): 'low' | 'medium' | 'high' {
  if (intensity < 33) return 'low';
  if (intensity < 67) return 'medium';
  return 'high';
}

/**
 * Gets opacity based on intensity level
 */
function getOpacity(intensity: number): number {
  const level = getIntensityLevel(intensity);
  switch (level) {
    case 'low':
      return 0.4;
    case 'medium':
      return 0.7;
    case 'high':
      return 1.0;
  }
}

/**
 * Gets size multiplier based on intensity level
 */
function getSizeMultiplier(intensity: number): number {
  const level = getIntensityLevel(intensity);
  switch (level) {
    case 'low':
      return 0.8;
    case 'medium':
      return 1.0;
    case 'high':
      return 1.2;
  }
}

/**
 * Reusable component for displaying color-coded intensity indicators
 * for behavioral signals
 */
export default function BehavioralIndicator({
  signal,
  position = 'top-right',
  size = 'medium',
  showLabel = true,
  showValue = false,
  customOffset = 0,
  customVerticalOffset = 0,
}: BehavioralIndicatorProps) {
  const color = SIGNAL_COLORS[signal.type];
  const intensity = signal.intensity;
  const opacity = getOpacity(intensity);
  const sizeMultiplier = getSizeMultiplier(intensity);
  const intensityLevel = getIntensityLevel(intensity);

  // Base sizes - increased for better visibility
  const baseSizes = {
    small: { width: 20, height: 20, fontSize: 'text-xs' },
    medium: { width: 24, height: 24, fontSize: 'text-sm' },
    large: { width: 28, height: 28, fontSize: 'text-base' },
  };

  const baseSize = baseSizes[size];
  const actualWidth = baseSize.width * sizeMultiplier;
  const actualHeight = baseSize.height * sizeMultiplier;

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top': 'top-4 left-1/2 -translate-x-1/2',
    'bottom': 'bottom-4 left-1/2 -translate-x-1/2',
    'left': 'left-4 top-1/2 -translate-y-1/2',
    'right': 'right-4 top-1/2 -translate-y-1/2',
    'custom': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  // Format signal type name
  const signalName = signal.type.charAt(0).toUpperCase() + signal.type.slice(1);

  // Custom positioning style: above transcript bar (reserve ~120px for live transcript so signals don't overlap)
  const customStyle = position === 'custom' 
    ? { 
        transform: `translate(calc(-50% + ${customOffset}px), 0)`,
        bottom: `${150 + customVerticalOffset}px`,
      }
    : {};

  return (
    <div
      className={`absolute ${positionClasses[position]} flex items-center gap-2 z-30 transition-all duration-500 ease-out animate-scale-in`}
      style={{
        opacity,
        ...customStyle,
      }}
    >
      {/* Indicator circle/bar */}
      <div
        className="rounded-full shadow-lg border-2 border-white/80 transition-all duration-500"
        style={{
          width: `${actualWidth}px`,
          height: `${actualHeight}px`,
          backgroundColor: color,
          boxShadow: `0 0 ${intensityLevel === 'high' ? '16px' : intensityLevel === 'medium' ? '10px' : '6px'} ${color}${intensityLevel === 'high' ? '60' : intensityLevel === 'medium' ? '50' : '40'}`,
          animation: intensityLevel === 'high' ? 'pulse-glow 2s ease-in-out infinite' : 'none',
        }}
        title={`${signalName}: ${intensity}%`}
      >
        {/* Intensity fill gradient */}
        <div
          className="w-full h-full rounded-full transition-all duration-500"
          style={{
            background: `radial-gradient(circle, ${color}ff ${intensity}%, ${color}00 ${intensity}%)`,
          }}
        />
        {/* Pulsing ring for high intensity */}
        {intensityLevel === 'high' && (
          <div
            className="absolute inset-0 rounded-full border-2 animate-ping"
            style={{
              borderColor: color,
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Label and value */}
      {(showLabel || showValue) && (
        <div className="glass-dark px-3 py-1.5 rounded-lg text-white flex items-center gap-2 shadow-xl border border-white/10 backdrop-blur-xl transition-all duration-300">
          {showLabel && (
            <span className={`${baseSize.fontSize} font-semibold drop-shadow-md`} style={{ color }}>
              {signalName}
            </span>
          )}
          {showValue && (
            <span className={`${baseSize.fontSize} font-bold drop-shadow-md bg-white/10 px-1.5 py-0.5 rounded`}>
              {intensity}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

