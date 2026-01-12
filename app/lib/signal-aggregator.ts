/**
 * Signal aggregator for tracking behavioral signals over a rolling time window
 * Calculates duration-based intensity using signal persistence metrics
 */

import { BehavioralSignal } from './types';

export interface SignalAggregatorConfig {
  windowMs?: number; // Time window in milliseconds (default: 15000ms = 15 seconds)
}

/**
 * Signal aggregator class that tracks signals over time and calculates
 * duration-based intensity values based on signal persistence
 */
export class SignalAggregator {
  private signalHistory: BehavioralSignal[] = [];
  private windowMs: number;

  constructor(config: SignalAggregatorConfig = {}) {
    this.windowMs = config.windowMs || 15000; // Default 15 seconds
  }

  /**
   * Adds new signals to the history and removes signals outside the time window
   * @param signals New signals to add
   * @param currentTime Optional current timestamp (defaults to Date.now())
   */
  addSignals(signals: BehavioralSignal[], currentTime?: number): void {
    const now = currentTime || Date.now();
    const cutoffTime = now - this.windowMs;

    // Add new signals with current timestamp if not provided
    const newSignals = signals.map(signal => ({
      ...signal,
      timestamp: signal.timestamp || now,
    }));

    // Add new signals to history
    this.signalHistory.push(...newSignals);

    // Remove signals outside the time window
    this.signalHistory = this.signalHistory.filter(
      signal => signal.timestamp >= cutoffTime
    );

    // Sort by timestamp (oldest first) for easier processing
    this.signalHistory.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Gets the persistence of a signal type over the time window
   * Persistence is calculated as the percentage of time window where the signal was detected
   * @param signalType Type of signal to check
   * @param currentTime Optional current timestamp (defaults to Date.now())
   * @returns Persistence value between 0 and 1 (0 = never detected, 1 = detected throughout window)
   */
  getSignalPersistence(signalType: string, currentTime?: number): number {
    const now = currentTime || Date.now();
    const cutoffTime = now - this.windowMs;

    // Get all signals of this type within the time window
    const typeSignals = this.signalHistory.filter(
      signal => signal.type === signalType && signal.timestamp >= cutoffTime
    );

    if (typeSignals.length === 0) {
      return 0;
    }

    // Calculate the time span covered by these signals
    // For simplicity, we count unique analysis cycles (each signal represents one analysis)
    // Since analysis happens every 2 seconds, we can count occurrences
    const uniqueTimestamps = new Set(typeSignals.map(s => s.timestamp));
    
    // Estimate number of analysis cycles in the window
    // Assuming analysis happens every 2 seconds, we have approximately windowMs/2000 cycles
    const estimatedCycles = Math.ceil(this.windowMs / 2000);
    
    // Persistence is the ratio of cycles where signal was detected
    const detectedCycles = uniqueTimestamps.size;
    const persistence = Math.min(1, detectedCycles / estimatedCycles);

    return persistence;
  }

  /**
   * Gets the frequency of a signal type in the time window
   * @param signalType Type of signal to check
   * @param currentTime Optional current timestamp (defaults to Date.now())
   * @returns Number of occurrences in the window
   */
  getSignalFrequency(signalType: string, currentTime?: number): number {
    const now = currentTime || Date.now();
    const cutoffTime = now - this.windowMs;

    return this.signalHistory.filter(
      signal => signal.type === signalType && signal.timestamp >= cutoffTime
    ).length;
  }

  /**
   * Calculates duration-based intensity from base intensity and persistence
   * Formula: baseIntensity + (100 - baseIntensity) * persistence
   * This scales from base intensity (fleeting) to 100 (very persistent)
   * @param signalType Type of signal
   * @param baseIntensity Base intensity value (0-100)
   * @param currentTime Optional current timestamp (defaults to Date.now())
   * @returns Calculated intensity (0-100)
   */
  calculateIntensity(
    signalType: string,
    baseIntensity: number,
    currentTime?: number
  ): number {
    const persistence = this.getSignalPersistence(signalType, currentTime);
    
    // Formula: baseIntensity + (100 - baseIntensity) * persistence
    // Minimum: baseIntensity (fleeting emotion, persistence = 0)
    // Maximum: 100 (very persistent emotion, persistence = 1)
    const calculatedIntensity = baseIntensity + (100 - baseIntensity) * persistence;
    
    // Clamp to 0-100 range
    return Math.round(Math.max(0, Math.min(100, calculatedIntensity)));
  }

  /**
   * Gets all signal types that have appeared in the time window
   * @param currentTime Optional current timestamp (defaults to Date.now())
   * @returns Array of unique signal types
   */
  getActiveSignalTypes(currentTime?: number): string[] {
    const now = currentTime || Date.now();
    const cutoffTime = now - this.windowMs;

    const types = new Set(
      this.signalHistory
        .filter(signal => signal.timestamp >= cutoffTime)
        .map(signal => signal.type)
    );

    return Array.from(types);
  }

  /**
   * Clears all signal history
   */
  clear(): void {
    this.signalHistory = [];
  }

  /**
   * Gets the current time window size in milliseconds
   */
  getWindowSize(): number {
    return this.windowMs;
  }

  /**
   * Sets a new time window size in milliseconds
   */
  setWindowSize(windowMs: number): void {
    this.windowMs = windowMs;
    // Optionally clean up signals outside the new window
    const now = Date.now();
    const cutoffTime = now - this.windowMs;
    this.signalHistory = this.signalHistory.filter(
      signal => signal.timestamp >= cutoffTime
    );
  }

  /**
   * Gets all signals in the history (for session-level aggregation)
   * @returns All signals currently in history
   */
  getAllSignals(): BehavioralSignal[] {
    return [...this.signalHistory];
  }
}

/**
 * Aggregates behavioral signals over time and calculates statistics
 * These utility functions work with complete signal collections (e.g., entire session)
 */

export interface SignalStatistics {
  count: number;
  average: number;
  min: number;
  max: number;
  total: number;
}

export interface AggregatedSignals {
  [signalType: string]: SignalStatistics;
}

/**
 * Calculates the average stress score from a collection of behavioral signals
 * @param signals Array of behavioral signals
 * @returns Average stress score (0-100), or null if no stress signals found
 */
export function calculateAverageStressScore(
  signals: BehavioralSignal[]
): number | null {
  const stressSignals = signals.filter(signal => signal.type === 'stress');
  
  if (stressSignals.length === 0) {
    return null;
  }

  const sum = stressSignals.reduce((acc, signal) => acc + signal.intensity, 0);
  const average = sum / stressSignals.length;
  
  return Math.round(average);
}

/**
 * Calculates overall confidence score from behavioral signals
 * Combines positive confidence indicators (engagement, agreement) and subtracts
 * negative indicators (stress, confusion, hesitation, disengagement)
 * @param signals Array of behavioral signals
 * @returns Confidence score (0-100), or null if no relevant signals found
 */
export function calculateConfidenceScore(
  signals: BehavioralSignal[]
): number | null {
  // Positive confidence indicators
  const engagementSignals = signals.filter(s => s.type === 'engagement');
  const agreementSignals = signals.filter(s => s.type === 'agreement');
  
  // Negative confidence indicators
  const stressSignals = signals.filter(s => s.type === 'stress');
  const confusionSignals = signals.filter(s => s.type === 'confusion');
  const hesitationSignals = signals.filter(s => s.type === 'hesitation');
  const disengagementSignals = signals.filter(s => s.type === 'disengagement');

  // Need at least some signals to calculate confidence
  const totalSignals = signals.length;
  if (totalSignals === 0) {
    return null;
  }

  // Calculate average intensities for each signal type
  const engagementAvg = engagementSignals.length > 0
    ? engagementSignals.reduce((sum, s) => sum + s.intensity, 0) / engagementSignals.length
    : 0;
  
  const agreementAvg = agreementSignals.length > 0
    ? agreementSignals.reduce((sum, s) => sum + s.intensity, 0) / agreementSignals.length
    : 0;

  const stressAvg = stressSignals.length > 0
    ? stressSignals.reduce((sum, s) => sum + s.intensity, 0) / stressSignals.length
    : 0;
  
  const confusionAvg = confusionSignals.length > 0
    ? confusionSignals.reduce((sum, s) => sum + s.intensity, 0) / confusionSignals.length
    : 0;
  
  const hesitationAvg = hesitationSignals.length > 0
    ? hesitationSignals.reduce((sum, s) => sum + s.intensity, 0) / hesitationSignals.length
    : 0;
  
  const disengagementAvg = disengagementSignals.length > 0
    ? disengagementSignals.reduce((sum, s) => sum + s.intensity, 0) / disengagementSignals.length
    : 0;

  // Weighted calculation for confidence
  // Positive signals boost confidence
  const positiveScore = (engagementAvg * 0.5) + (agreementAvg * 0.5);
  
  // Negative signals reduce confidence
  // Stress and hesitation are weighted more heavily as they directly indicate lack of confidence
  const negativeScore = (stressAvg * 0.35) + (hesitationAvg * 0.30) + (confusionAvg * 0.20) + (disengagementAvg * 0.15);
  
  // Start from a baseline of 50 (neutral confidence)
  // Add positive contributions, subtract negative contributions
  const rawScore = 50 + (positiveScore * 0.5) - (negativeScore * 0.5);
  
  // Clamp to 0-100 range
  const normalizedScore = Math.max(0, Math.min(100, rawScore));

  return Math.round(normalizedScore);
}

/**
 * Calculates the average intensity for a specific signal type
 * @param signals Array of behavioral signals
 * @param signalType Type of signal to calculate average for
 * @returns Average intensity (0-100), or null if no signals of that type found
 */
export function calculateAverageIntensity(
  signals: BehavioralSignal[],
  signalType: string
): number | null {
  const filteredSignals = signals.filter(signal => signal.type === signalType);
  
  if (filteredSignals.length === 0) {
    return null;
  }

  const sum = filteredSignals.reduce((acc, signal) => acc + signal.intensity, 0);
  const average = sum / filteredSignals.length;
  
  return Math.round(average);
}

/**
 * Calculates statistics (count, average, min, max, total) for a specific signal type
 * @param signals Array of behavioral signals
 * @param signalType Type of signal to calculate statistics for
 * @returns Signal statistics, or null if no signals of that type found
 */
export function getSignalStatistics(
  signals: BehavioralSignal[],
  signalType: string
): SignalStatistics | null {
  const filteredSignals = signals.filter(signal => signal.type === signalType);
  
  if (filteredSignals.length === 0) {
    return null;
  }

  const intensities = filteredSignals.map(signal => signal.intensity);
  const sum = intensities.reduce((acc, intensity) => acc + intensity, 0);
  const average = sum / intensities.length;
  const min = Math.min(...intensities);
  const max = Math.max(...intensities);

  return {
    count: filteredSignals.length,
    average: Math.round(average),
    min,
    max,
    total: sum,
  };
}

/**
 * Aggregates all signal types and returns statistics for each type
 * @param signals Array of behavioral signals
 * @returns Object mapping signal types to their statistics
 */
export function aggregateSignalsByType(
  signals: BehavioralSignal[]
): AggregatedSignals {
  const aggregated: AggregatedSignals = {};
  const signalTypes = new Set(signals.map(signal => signal.type));

  for (const signalType of signalTypes) {
    const stats = getSignalStatistics(signals, signalType);
    if (stats) {
      aggregated[signalType] = stats;
    }
  }

  return aggregated;
}

/**
 * Filters signals by time range
 * @param signals Array of behavioral signals
 * @param startTime Start timestamp (inclusive)
 * @param endTime End timestamp (inclusive)
 * @returns Filtered signals within the time range
 */
export function filterSignalsByTimeRange(
  signals: BehavioralSignal[],
  startTime: number,
  endTime: number
): BehavioralSignal[] {
  return signals.filter(
    signal => signal.timestamp >= startTime && signal.timestamp <= endTime
  );
}

/**
 * Gets signals grouped by type
 * @param signals Array of behavioral signals
 * @returns Object mapping signal types to arrays of signals
 */
export function groupSignalsByType(
  signals: BehavioralSignal[]
): Record<string, BehavioralSignal[]> {
  const grouped: Record<string, BehavioralSignal[]> = {};

  for (const signal of signals) {
    if (!grouped[signal.type]) {
      grouped[signal.type] = [];
    }
    grouped[signal.type].push(signal);
  }

  return grouped;
}

/**
 * Calculates the total duration of a session based on signal timestamps
 * @param signals Array of behavioral signals
 * @returns Duration in milliseconds, or 0 if no signals
 */
export function calculateSessionDuration(
  signals: BehavioralSignal[]
): number {
  if (signals.length === 0) {
    return 0;
  }

  const timestamps = signals.map(signal => signal.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  return maxTime - minTime;
}

/**
 * Gets the peak intensity for a specific signal type
 * @param signals Array of behavioral signals
 * @param signalType Type of signal to find peak for
 * @returns Peak intensity value, or null if no signals of that type found
 */
export function getPeakIntensity(
  signals: BehavioralSignal[],
  signalType: string
): number | null {
  const filteredSignals = signals.filter(signal => signal.type === signalType);
  
  if (filteredSignals.length === 0) {
    return null;
  }

  return Math.max(...filteredSignals.map(signal => signal.intensity));
}

/**
 * Gets comprehensive session statistics including average stress score
 * @param signals Array of behavioral signals
 * @param startTime Optional session start time
 * @param endTime Optional session end time
 * @returns Comprehensive session statistics
 */
export interface SessionStatistics {
  totalSignals: number;
  duration: number;
  averageStressScore: number | null;
  confidenceScore: number | null;
  signalTypeStats: AggregatedSignals;
  peakStress: number | null;
  signalCounts: Record<string, number>;
}

export function getSessionStatistics(
  signals: BehavioralSignal[],
  startTime?: number,
  endTime?: number
): SessionStatistics {
  // Filter by time range if provided
  let filteredSignals = signals;
  if (startTime !== undefined || endTime !== undefined) {
    const start = startTime ?? Math.min(...signals.map(s => s.timestamp));
    const end = endTime ?? Math.max(...signals.map(s => s.timestamp));
    filteredSignals = filterSignalsByTimeRange(signals, start, end);
  }

  const duration = startTime && endTime 
    ? endTime - startTime 
    : calculateSessionDuration(filteredSignals);

  const averageStressScore = calculateAverageStressScore(filteredSignals);
  const confidenceScore = calculateConfidenceScore(filteredSignals);
  const signalTypeStats = aggregateSignalsByType(filteredSignals);
  const peakStress = getPeakIntensity(filteredSignals, 'stress');

  // Get signal counts by type
  const signalCounts: Record<string, number> = {};
  for (const signal of filteredSignals) {
    signalCounts[signal.type] = (signalCounts[signal.type] || 0) + 1;
  }

  return {
    totalSignals: filteredSignals.length,
    duration,
    averageStressScore,
    confidenceScore,
    signalTypeStats,
    peakStress,
    signalCounts,
  };
}

