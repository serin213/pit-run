/**
 * Qualifying grade calculation — 순수 함수, React/RN 의존 없음.
 * 미니앱에서 그대로 import 가능.
 */

import type { QualifyingGrade, QualifyingResult } from '../types';

type GradeThreshold = {
  maxPaceSec: number;
  grade: QualifyingGrade;
  hint: string;
};

/**
 * 등급 기준표 (빠른 순서).
 * 페이스(sec/km)가 threshold 이하이면 해당 등급.
 */
const GRADE_THRESHOLDS: GradeThreshold[] = [
  {
    maxPaceSec: 240,
    grade: 'f1_champion',
    hint: 'F1 Champion: 400m x 8, recovery 60s, target pace 4:00–4:20/km.',
  },
  {
    maxPaceSec: 270,
    grade: 'f1',
    hint: 'F1: 400m x 6, recovery 90s, target pace 4:45–5:05/km.',
  },
  {
    maxPaceSec: 330,
    grade: 'f1_rookie',
    hint: 'F1 Rookie: 400m x 5, recovery 90s, target pace 5:20–5:45/km.',
  },
  {
    maxPaceSec: 390,
    grade: 'f2',
    hint: 'F2: 300m x 5, recovery 90–120s, target pace 6:00–6:35/km.',
  },
];

/**
 * 등급별 최대 페이스(sec/km). 이 값 이하면 해당 등급 달성.
 * f3는 상한 없음(undefined).
 */
export const GRADE_PACE_MAX: Partial<Record<QualifyingGrade, number>> = Object.fromEntries(
  GRADE_THRESHOLDS.map((t) => [t.grade, t.maxPaceSec]),
) as Partial<Record<QualifyingGrade, number>>;

const FALLBACK_GRADE: Omit<GradeThreshold, 'maxPaceSec'> = {
  grade: 'f3',
  hint: 'F3: 1min run + 1min walk x 10, then repeat qualifying next week.',
};

/** 1km 소요 시간(ms)으로 등급 결정 */
export function calculateGrade(oneKmMs: number): QualifyingGrade {
  const paceSec = oneKmMs / 1000;
  for (const t of GRADE_THRESHOLDS) {
    if (paceSec <= t.maxPaceSec) return t.grade;
  }
  return FALLBACK_GRADE.grade;
}

/** 1km 소요 시간(ms)으로 전체 QualifyingResult 빌드 */
export function buildQualifyingResult(
  oneKmMs: number,
  warmupMinutes: number,
): QualifyingResult {
  const paceSec = oneKmMs / 1000;

  for (const t of GRADE_THRESHOLDS) {
    if (paceSec <= t.maxPaceSec) {
      return {
        warmupMinutes,
        oneKmMs,
        paceSecPerKm: paceSec,
        grade: t.grade,
        nextIntervalHint: t.hint,
      };
    }
  }

  return {
    warmupMinutes,
    oneKmMs,
    paceSecPerKm: paceSec,
    grade: FALLBACK_GRADE.grade,
    nextIntervalHint: FALLBACK_GRADE.hint,
  };
}
