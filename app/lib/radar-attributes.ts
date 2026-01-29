/**
 * Configurable emotional/behavioral attributes for the timeline radar chart.
 * Designed to be adaptable across scenarios and inclusive of different
 * communication styles (e.g. different ways people express confidence,
 * warmth, or assertiveness).
 */

import { BehavioralSignal } from './types';
import { getSignalStatistics } from './signal-aggregator';

export interface RadarAttributeDefinition {
  id: string;
  label: string;
  description: string;
  /** Signal types that increase this attribute's score (0–100) */
  positiveSignals: string[];
  /** Signal types that decrease this attribute's score */
  negativeSignals: string[];
  /**
   * If true, score = 100 - average(negativeSignals). Use for attributes
   * like Calmness where "low stress" is the goal.
   */
  inverseOfNegative?: boolean;
}

export interface RadarScenario {
  id: string;
  name: string;
  description: string;
  /** Exactly 5 attribute IDs to show on the radar */
  attributeIds: [string, string, string, string, string];
}

/**
 * Core emotional/behavioral attributes. Mapped to existing behavioral signals
 * so the same session data can be viewed through different lenses (e.g.
 * "confidence" vs "warmth"). Success looks different in different contexts
 * and for different communicators.
 */
export const RADAR_ATTRIBUTES: RadarAttributeDefinition[] = [
  {
    id: 'confidence',
    label: 'Confidence',
    description: 'Presence and self-assuredness; engagement and agreement vs stress and hesitation.',
    positiveSignals: ['engagement', 'agreement', 'confidence'],
    negativeSignals: ['stress', 'confusion', 'hesitation', 'disengagement'],
  },
  {
    id: 'calmness',
    label: 'Calmness',
    description: 'Composed, low stress and frustration; steady presence.',
    positiveSignals: [],
    negativeSignals: ['stress', 'frustration', 'confusion'],
    inverseOfNegative: true,
  },
  {
    id: 'clarity',
    label: 'Clarity',
    description: 'Clear communication; low confusion and uncertainty.',
    positiveSignals: ['engagement'],
    negativeSignals: ['confusion', 'uncertainty', 'hesitation'],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    description: 'Attention and involvement; interest vs disengagement.',
    positiveSignals: ['engagement', 'interest'],
    negativeSignals: ['disengagement'],
  },
  {
    id: 'receptivity',
    label: 'Receptivity',
    description: 'Openness to others’ ideas; agreement and interest vs disagreement and skepticism.',
    positiveSignals: ['agreement', 'interest'],
    negativeSignals: ['disagreement', 'skepticism'],
  },
  {
    id: 'assertiveness',
    label: 'Assertiveness',
    description: 'Clear stance and directness; confidence and willingness to disagree when needed.',
    positiveSignals: ['confidence', 'engagement'],
    negativeSignals: ['hesitation', 'uncertainty'],
  },
  {
    id: 'composure',
    label: 'Composure',
    description: 'Emotional regulation under pressure; low stress and frustration.',
    positiveSignals: ['engagement', 'agreement'],
    negativeSignals: ['stress', 'frustration', 'confusion'],
  },
  {
    id: 'warmth',
    label: 'Warmth',
    description: 'Connection and rapport; agreement, engagement, and interest.',
    positiveSignals: ['agreement', 'engagement', 'interest'],
    negativeSignals: ['frustration', 'disagreement', 'disengagement'],
  },
  {
    id: 'conviction',
    label: 'Conviction',
    description: 'Clarity of stance; confidence and low hesitation.',
    positiveSignals: ['confidence', 'agreement'],
    negativeSignals: ['hesitation', 'uncertainty', 'skepticism'],
  },
  {
    id: 'openness',
    label: 'Openness',
    description: 'Receptive and curious; interest and agreement vs skepticism.',
    positiveSignals: ['interest', 'agreement', 'engagement'],
    negativeSignals: ['skepticism', 'disagreement'],
  },
];

/**
 * Scenarios select 5 attributes relevant to that context. Different
 * contexts (and different communicators) value different combinations—
 * e.g. presentation vs collaboration, or assertiveness vs warmth.
 */
export const RADAR_SCENARIOS: RadarScenario[] = [
  {
    id: 'general',
    name: 'General conversation',
    description: 'Confidence, calmness, clarity, engagement, and receptivity.',
    attributeIds: ['confidence', 'calmness', 'clarity', 'engagement', 'receptivity'],
  },
  {
    id: 'presentation',
    name: 'Presentation / pitching',
    description: 'Presence, clarity, confidence, composure, and conviction.',
    attributeIds: ['confidence', 'clarity', 'composure', 'engagement', 'conviction'],
  },
  {
    id: 'interview',
    name: 'Interview',
    description: 'Confidence, composure, clarity, engagement, and receptivity.',
    attributeIds: ['confidence', 'composure', 'clarity', 'engagement', 'receptivity'],
  },
  {
    id: 'collaboration',
    name: 'Collaboration / teamwork',
    description: 'Warmth, receptivity, engagement, openness, and calmness.',
    attributeIds: ['warmth', 'receptivity', 'engagement', 'openness', 'calmness'],
  },
  {
    id: 'negotiation',
    name: 'Negotiation / influence',
    description: 'Assertiveness, confidence, composure, conviction, and receptivity.',
    attributeIds: ['assertiveness', 'confidence', 'composure', 'conviction', 'receptivity'],
  },
];

const ATTRIBUTES_BY_ID = new Map(RADAR_ATTRIBUTES.map((a) => [a.id, a]));

function getAverageIntensityForTypes(
  signals: BehavioralSignal[],
  types: string[]
): number {
  if (types.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const type of types) {
    const stats = getSignalStatistics(signals, type);
    if (stats) {
      sum += stats.average;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Compute 0–100 score for one attribute from session signals.
 */
export function getAttributeScore(
  signals: BehavioralSignal[],
  attribute: RadarAttributeDefinition
): number {
  if (signals.length === 0) return 50; // neutral when no data

  const posAvg = getAverageIntensityForTypes(signals, attribute.positiveSignals);
  const negAvg = getAverageIntensityForTypes(signals, attribute.negativeSignals);

  if (attribute.inverseOfNegative) {
    return Math.round(Math.max(0, Math.min(100, 100 - negAvg)));
  }
  const raw = 50 + (posAvg - negAvg) * 0.5;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Get radar data for the given scenario: 5 attributes with labels and scores.
 */
export function getRadarScores(
  signals: BehavioralSignal[],
  scenario: RadarScenario
): Array<{ id: string; label: string; value: number }> {
  return scenario.attributeIds.map((id) => {
    const attr = ATTRIBUTES_BY_ID.get(id);
    const label = attr ? attr.label : id;
    const value = attr ? getAttributeScore(signals, attr) : 50;
    return { id, label, value };
  });
}

export function getScenarioById(id: string): RadarScenario | undefined {
  return RADAR_SCENARIOS.find((s) => s.id === id);
}

export function getAttributeById(id: string): RadarAttributeDefinition | undefined {
  return ATTRIBUTES_BY_ID.get(id);
}
