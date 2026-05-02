// ─── Types ──────────────────────────────────────────────────────────────────

export type Tire = 'soft' | 'medium' | 'hard';

import type { Grade } from '../../types/qualifying';
export type { Grade };

export type Circuit = {
  id: string;
  baseIntervalM: number;
  baseReps: number;
};

export type User = {
  trainingBasePace: number;
  grade: Grade;
  totalSessionCount: number;
};

export type Recovery =
  | { mode: 'walk'; label: 'WALK'; maxPace: number; durationSec: number }
  | { mode: 'jog'; label: 'EASY'; pace: number; durationSec: number };

export type Program = {
  intervals: {
    distanceM: number;
    reps: number;
    hardPace: number;
  };
  recovery: Recovery;
  cyclePhase: string;
  totals: {
    hardDistanceM: number;
    hardDurationSec: number;
    recoveryDurationSec: number;
  };
};

// ─── Constants (Remote Config 외부 주입 예정) ─────────────────────────────────

export const TIRE_PROFILE: Record<
  Tire,
  { distance: number; reps: number; pace: number; recovery: number }
> = {
  soft: { distance: 0.80, reps: 1.25, pace: 0.97, recovery: 1.2 },
  medium: { distance: 1.00, reps: 1.00, pace: 1.00, recovery: 1.0 },
  hard: { distance: 1.20, reps: 0.83, pace: 1.05, recovery: 0.7 },
};

export const GRADE_PROFILE: Record<
  Grade,
  { reps: number; paceFloor: number; repsBounds: { min: number; max: number } }
> = {
  f3: { reps: 0.6, paceFloor: 0.96, repsBounds: { min: 3, max: 8 } },
  f2: { reps: 0.8, paceFloor: 0.94, repsBounds: { min: 4, max: 10 } },
  f1_rookie: { reps: 1.0, paceFloor: 0.92, repsBounds: { min: 4, max: 12 } },
  f1: { reps: 1.0, paceFloor: 0.90, repsBounds: { min: 5, max: 12 } },
  f1_champion: { reps: 1.2, paceFloor: 0.88, repsBounds: { min: 5, max: 14 } },
};

export const RIEGEL_EXPONENT = 0.06;
export const EASY_PACE_FACTOR = 1.30;
export const WALK_THRESHOLD_SEC = 540;
export const MIN_HARD_DISTANCE_KM = 1.0;
export const MIN_INTERVAL_M = 100;
export const RECOVERY_BOUNDS_SEC = { min: 60, max: 240 };

export const PROGRESSION: { factor: number; label: string }[] = [
  { factor: 1.00, label: 'BASE' },
  { factor: 1.05, label: 'BUILD' },
  { factor: 1.10, label: 'PEAK' },
  { factor: 0.85, label: 'RECOVERY' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function calcDistanceFactor(
  intervalKm: number,
  paceFloor: number,
): number {
  if (intervalKm >= 1.0) {
    return Math.pow(intervalKm, RIEGEL_EXPONENT);
  }
  const speedupRange = 1.0 - paceFloor;
  return 1.0 - speedupRange * (1.0 - intervalKm);
}

export function clampReps(
  rawReps: number,
  intervalM: number,
  bounds: { min: number; max: number },
  cycleFactor: number,
): number {
  const targetVolumeKm = MIN_HARD_DISTANCE_KM * cycleFactor;
  const minForVolume = Math.ceil((targetVolumeKm * 1000) / intervalM);
  const rounded = Math.round(rawReps);

  if (minForVolume > bounds.max) {
    return Math.min(bounds.max, Math.max(rounded, bounds.min));
  }

  const effectiveMin = Math.max(bounds.min, minForVolume);
  return Math.max(effectiveMin, Math.min(bounds.max, rounded));
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function buildProgram(
  user: User,
  circuit: Circuit,
  tire: Tire,
): Program {
  // 1단계: 변수 셋업
  const t = TIRE_PROFILE[tire];
  const g = GRADE_PROFILE[user.grade];
  const sessionCount = user.totalSessionCount || 0;
  const cycle = PROGRESSION[sessionCount % 4];

  // 2단계: 인터벌 거리
  const intervalM = Math.max(
    MIN_INTERVAL_M,
    Math.round(circuit.baseIntervalM * t.distance),
  );
  const intervalKm = intervalM / 1000;

  // 3단계: reps
  const rawReps = circuit.baseReps * g.reps * t.reps * cycle.factor;
  const reps = clampReps(rawReps, intervalM, g.repsBounds, cycle.factor);

  // 4단계: hard 페이스
  const distanceFactor = calcDistanceFactor(intervalKm, g.paceFloor);
  const hardPace = Math.round(user.trainingBasePace * distanceFactor * t.pace);

  // 5단계: recovery
  const intervalSec = intervalKm * hardPace;
  const recoverySec = clamp(
    Math.round(intervalSec * t.recovery),
    RECOVERY_BOUNDS_SEC.min,
    RECOVERY_BOUNDS_SEC.max,
  );
  const easyPaceRaw = user.trainingBasePace * EASY_PACE_FACTOR;

  const recovery: Recovery =
    easyPaceRaw > WALK_THRESHOLD_SEC
      ? {
          mode: 'walk',
          label: 'WALK',
          maxPace: WALK_THRESHOLD_SEC,
          durationSec: recoverySec,
        }
      : {
          mode: 'jog',
          label: 'EASY',
          pace: Math.round(easyPaceRaw),
          durationSec: recoverySec,
        };

  // 6단계: totals
  const hardDistanceM = intervalM * reps;
  const hardDurationSec = Math.round(intervalKm * hardPace * reps);
  const recoveryDurationSec = recoverySec * Math.max(0, reps - 1);

  // 7단계: 반환
  return {
    intervals: { distanceM: intervalM, reps, hardPace },
    recovery,
    cyclePhase: cycle.label,
    totals: { hardDistanceM, hardDurationSec, recoveryDurationSec },
  };
}
