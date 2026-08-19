// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Confidence Scoring
// ─────────────────────────────────────────────────────────────────────────────

import { ConfidenceLevel } from '../types/intelligence';

/**
 * Maps a numeric confidence score (0.0 to 1.0) to a user-friendly label.
 *
 *  >= 0.80  -> High
 *  >= 0.50  -> Medium
 *  < 0.50   -> Low
 */
export function confidenceToLabel(score: number): ConfidenceLevel {
  if (score >= 0.8) return 'High';
  if (score >= 0.5) return 'Medium';
  return 'Low';
}

/**
 * Clamp a number to [min, max] range with 2 decimal precision.
 */
export function clampScore(score: number, min = 0.0, max = 1.0): number {
  const clamped = Math.max(min, Math.min(max, score));
  return Math.round(clamped * 100) / 100;
}
