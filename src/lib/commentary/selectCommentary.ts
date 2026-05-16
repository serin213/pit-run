import type { Grade } from '../ranking/types';
import { MESSAGES, type MessageEntry, type MessageCategoryKey } from './messages';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommentaryTire = 'soft' | 'medium' | 'hard' | 'wet';

export interface CommentaryInput {
  /** Date.now() at race completion — used for time-of-day and deterministic pick */
  completedAt: number;

  circuitId: string;

  /** Tire used in the run. null = history mode (not tracked) */
  tire: CommentaryTire | null;

  /** Overall average pace sec/km */
  avgPaceSec: number;

  /** Per-sector paces (sec/km) — same array as paceHistory in run store */
  sectorPaces: number[];

  // ── Achievement flags (computed from session history in caller) ────────────
  isOverallPB: boolean;
  isCircuitPB: boolean;

  // ── Goal ──────────────────────────────────────────────────────────────────
  /** Qualifying pace used as race target. null = not set yet */
  goalPaceSec: number | null;

  // ── Grade ─────────────────────────────────────────────────────────────────
  userGrade: Grade;
  /** Display name of next grade, null if already at max grade */
  nextGradeName: string | null;
  /** Pace threshold to reach next grade (sec/km) */
  nextGradePaceSec: number | null;

  // ── History (computed from session history + activity dates in caller) ─────
  /** Total races completed including the current one. 0 = unknown */
  totalRaceCount: number;
  /** Days since the previous race. null = first race or unknown */
  daysSinceLastRace: number | null;
  /** Consecutive days with at least one run */
  currentStreakDays: number;
}

export interface CommentaryResult {
  message: string;
  /** Category key for analytics / debugging */
  category: MessageCategoryKey;
  messageId: string;
}

// ─── Thresholds (constants, not exported — change here to tune rules) ─────────

/** Days gap before a run is considered a comeback */
const COMEBACK_THRESHOLD_DAYS = 7;

/** Race counts that trigger milestone messages */
const MILESTONE_RACE_COUNTS: readonly number[] = [5, 10, 25, 50, 100, 200, 500];

/**
 * How close to goal pace (relative) to trigger tyre_strategy_hit instead of
 * generic goal_hit. E.g. 0.03 = within 3% of goal pace.
 */
const TYRE_STRATEGY_TOLERANCE = 0.03;

/** Minimum sectors needed to evaluate pace consistency */
const CONSISTENT_PACE_MIN_SECTORS = 3;

/** Coefficient of variation threshold for consistent_pace (std / mean) */
const CONSISTENT_PACE_CV_THRESHOLD = 0.05;

/** Second half must be this much faster (relative) for negative_split */
const NEGATIVE_SPLIT_THRESHOLD = 0.03;

/**
 * Last sector must be this much slower than the average of the rest
 * for fade to trigger.
 */
const FADE_THRESHOLD = 0.10;

/**
 * avgPaceSec must be within this much ABOVE nextGradePaceSec to be
 * considered "close" to promotion.
 * E.g. 0.05 = up to 5% slower than the next-grade threshold.
 */
const PROMOTION_CLOSE_TOLERANCE = 0.05;

/** Minimum streak days to show a streak message */
const STREAK_MIN_DAYS = 3;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Deterministic index into an array.
 * Uses seconds-level timestamp so the same run always gets the same message
 * even if the component re-renders.
 */
function deterministicIndex(seed: number, length: number): number {
  return Math.floor(seed / 1000) % length;
}

function resolveVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function buildResult(
  category: MessageCategoryKey,
  entries: readonly MessageEntry[],
  seed: number,
  vars: Record<string, string> = {},
): CommentaryResult {
  const entry = entries[deterministicIndex(seed, entries.length)];
  return {
    message:    resolveVariables(entry.message, vars),
    category,
    messageId:  entry.id,
  };
}

/** Standard deviation of an array of numbers */
function stdDev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function isConsistentPace(sectorPaces: number[]): boolean {
  const avg = mean(sectorPaces);
  if (avg === 0) return false;
  return stdDev(sectorPaces) / avg < CONSISTENT_PACE_CV_THRESHOLD;
}

/**
 * True if the second half of the run was faster (lower sec/km) than the first.
 * Middle sector (odd-length arrays) is excluded from both halves.
 */
function isNegativeSplit(sectorPaces: number[]): boolean {
  const n = sectorPaces.length;
  const firstHalf  = sectorPaces.slice(0, Math.floor(n / 2));
  const secondHalf = sectorPaces.slice(Math.ceil(n / 2));
  if (firstHalf.length === 0 || secondHalf.length === 0) return false;
  const firstAvg  = mean(firstHalf);
  const secondAvg = mean(secondHalf);
  // Negative split: second half is faster (lower pace) by at least threshold
  return secondAvg < firstAvg * (1 - NEGATIVE_SPLIT_THRESHOLD);
}

/** True if the last sector is significantly slower than the rest */
function isFade(sectorPaces: number[]): boolean {
  const n = sectorPaces.length;
  const restAvg = mean(sectorPaces.slice(0, n - 1));
  const last    = sectorPaces[n - 1];
  return last > restAvg * (1 + FADE_THRESHOLD);
}

/** True if the runner's pace is within PROMOTION_CLOSE_TOLERANCE above the next grade threshold */
function isPromotionClose(avgPaceSec: number, nextGradePaceSec: number): boolean {
  return (
    avgPaceSec > nextGradePaceSec &&
    avgPaceSec <= nextGradePaceSec * (1 + PROMOTION_CLOSE_TOLERANCE)
  );
}

/** Hour (0-23) → commentary category for time-of-day fallback */
function timeOfDayCategory(hour: number): MessageCategoryKey {
  if (hour >= 4  && hour < 6)  return 'dawn';
  if (hour >= 6  && hour < 17) return 'morning';  // morning + afternoon
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night'; // 21-24, 0-4
}

/** "11:42 PM" style formatting for the {time} variable in night messages */
function formatTime(date: Date): string {
  const h  = date.getHours();
  const m  = date.getMinutes();
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm  = String(m).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hh}:${mm} ${ampm}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Pure function — selects a single commentary message based on the run context.
 *
 * Priority (highest → lowest):
 *  1. first_race        — totalRaceCount === 1
 *  2. overall_pb        — isOverallPB
 *  3. circuit_pb        — isCircuitPB
 *  4. wet_tyre          — tire === 'wet'
 *  5. comeback          — daysSinceLastRace >= COMEBACK_THRESHOLD_DAYS
 *  6. milestone_race    — totalRaceCount in MILESTONE_RACE_COUNTS
 *  7. tyre_strategy_hit — goal set, hit within TYRE_STRATEGY_TOLERANCE
 *  8. goal_hit          — goalPaceSec set and avgPace ≤ goal
 *  9. goal_missed       — goalPaceSec set and avgPace > goal
 * 10. consistent_pace   — CV of sector paces < threshold (≥3 sectors)
 * 11. negative_split    — second half faster than first (≥2 sectors)
 * 12. fade              — last sector significantly slower (≥2 sectors)
 * 13. promotion_close   — pace within threshold above next grade
 * 14. streak            — currentStreakDays ≥ STREAK_MIN_DAYS
 * 15. time of day       — dawn / morning / evening / night (always fires)
 */
export function selectCommentary(input: CommentaryInput): CommentaryResult {
  const { completedAt, sectorPaces, avgPaceSec, tire, goalPaceSec } = input;
  const seed = completedAt;
  const date = new Date(completedAt);
  const hour = date.getHours();

  // 1. First race
  if (input.totalRaceCount === 1) {
    return buildResult('first_race', MESSAGES.first_race, seed);
  }

  // 2. Overall PB
  if (input.isOverallPB) {
    return buildResult('overall_pb', MESSAGES.overall_pb, seed);
  }

  // 3. Circuit PB
  if (input.isCircuitPB) {
    return buildResult('circuit_pb', MESSAGES.circuit_pb, seed);
  }

  // 4. Wet tyre (recovery run — no performance evaluation needed)
  if (tire === 'wet') {
    return buildResult('wet_tyre', MESSAGES.wet_tyre, seed);
  }

  // 5. Comeback
  if (
    input.daysSinceLastRace !== null &&
    input.daysSinceLastRace >= COMEBACK_THRESHOLD_DAYS
  ) {
    return buildResult('comeback', MESSAGES.comeback, seed, {
      n: String(input.daysSinceLastRace),
    });
  }

  // 6. Milestone race
  if (
    input.totalRaceCount > 1 &&
    (MILESTONE_RACE_COUNTS as readonly number[]).includes(input.totalRaceCount)
  ) {
    return buildResult('milestone_race', MESSAGES.milestone_race, seed, {
      n: String(input.totalRaceCount),
    });
  }

  // 7. Tyre strategy hit (goal achieved with very tight pacing)
  // Note: tire !== 'wet' is already guaranteed — wet_tyre returned above (priority 4)
  if (
    tire !== null &&
    goalPaceSec !== null &&
    avgPaceSec <= goalPaceSec &&
    (goalPaceSec - avgPaceSec) / goalPaceSec <= TYRE_STRATEGY_TOLERANCE
  ) {
    return buildResult('tyre_strategy_hit', MESSAGES.tyre_strategy_hit, seed);
  }

  // 8. Goal hit
  if (goalPaceSec !== null && avgPaceSec <= goalPaceSec) {
    return buildResult('goal_hit', MESSAGES.goal_hit, seed);
  }

  // 9. Goal missed
  if (goalPaceSec !== null && avgPaceSec > goalPaceSec) {
    return buildResult('goal_missed', MESSAGES.goal_missed, seed);
  }

  // 10. Consistent pace
  if (
    sectorPaces.length >= CONSISTENT_PACE_MIN_SECTORS &&
    isConsistentPace(sectorPaces)
  ) {
    return buildResult('consistent_pace', MESSAGES.consistent_pace, seed);
  }

  // 11. Negative split
  if (sectorPaces.length >= 2 && isNegativeSplit(sectorPaces)) {
    return buildResult('negative_split', MESSAGES.negative_split, seed);
  }

  // 12. Fade
  if (sectorPaces.length >= 2 && isFade(sectorPaces)) {
    return buildResult('fade', MESSAGES.fade, seed);
  }

  // 13. Promotion close
  if (
    input.nextGradePaceSec !== null &&
    input.nextGradeName !== null &&
    isPromotionClose(avgPaceSec, input.nextGradePaceSec)
  ) {
    return buildResult('promotion_close', MESSAGES.promotion_close, seed, {
      next_grade: input.nextGradeName,
    });
  }

  // 14. Streak
  if (input.currentStreakDays >= STREAK_MIN_DAYS) {
    return buildResult('streak', MESSAGES.streak, seed, {
      n: String(input.currentStreakDays),
    });
  }

  // 15. Time of day (always fires — final fallback)
  const category = timeOfDayCategory(hour);
  const vars: Record<string, string> = category === 'night' ? { time: formatTime(date) } : {};
  return buildResult(category, MESSAGES[category], seed, vars);
}
