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
}

