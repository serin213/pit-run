/**
 * Interval plan generation — 순수 함수, React/RN 의존 없음.
 *
 * 퀄리파잉 등급 기반으로 인터벌 러닝 플랜 세그먼트를 생성한다.
 * 미니앱에서 그대로 import 가능.
 */

import type { QualifyingGrade } from '../types';

export type SegmentType = 'warmup' | 'run' | 'recovery' | 'cooldown';

export type IntervalSegment = {
  type: SegmentType;
  /** 거리 (m). run/recovery 세그먼트에서 사용. */
  distanceM?: number;
  /** 시간 (초). warmup/cooldown 또는 시간 기반 세그먼트. */
  durationSec?: number;
  /** 목표 페이스 (sec/km). run 세그먼트에서 사용. */
  targetPaceSecPerKm?: number;
};

export type IntervalPlan = {
  grade: QualifyingGrade;
  totalSegments: number;
  segments: IntervalSegment[];
};

/**
 * 등급 기반 인터벌 플랜 생성.
 *
 * @param grade - 퀄리파잉 등급
 * @param paceSecPerKm - 1km 기준 페이스 (sec)
 */
export function generateIntervalPlan(
  grade: QualifyingGrade,
  paceSecPerKm: number,
): IntervalPlan {
  const warmup: IntervalSegment = { type: 'warmup', durationSec: 300 }; // 5min
  const cooldown: IntervalSegment = { type: 'cooldown', durationSec: 300 }; // 5min

  let runSegments: IntervalSegment[];

  switch (grade) {
    case 'f1_champion':
      runSegments = buildRepeats(8, 400, 60, paceSecPerKm * 0.85);
      break;
    case 'f1':
      runSegments = buildRepeats(6, 400, 90, paceSecPerKm * 0.9);
      break;
    case 'f1_rookie':
      runSegments = buildRepeats(5, 400, 90, paceSecPerKm * 0.92);
      break;
    case 'f2':
      runSegments = buildRepeats(5, 300, 105, paceSecPerKm * 0.95);
      break;
    case 'f3':
      runSegments = buildTimeRepeats(10, 60, 60);
      break;
    default:
      runSegments = buildTimeRepeats(10, 60, 60);
  }

  const segments = [warmup, ...runSegments, cooldown];
  return { grade, totalSegments: segments.length, segments };
}

/** 거리 기반 인터벌 반복 생성 (run + recovery) */
function buildRepeats(
  reps: number,
  distanceM: number,
  recoverySec: number,
  targetPace: number,
): IntervalSegment[] {
  const result: IntervalSegment[] = [];
  for (let i = 0; i < reps; i++) {
    result.push({
      type: 'run',
      distanceM,
      targetPaceSecPerKm: Math.round(targetPace),
    });
    if (i < reps - 1) {
      result.push({
        type: 'recovery',
        durationSec: recoverySec,
      });
    }
  }
  return result;
}

/** 시간 기반 인터벌 반복 생성 (run + recovery) */
function buildTimeRepeats(
  reps: number,
  runSec: number,
  recoverySec: number,
): IntervalSegment[] {
  const result: IntervalSegment[] = [];
  for (let i = 0; i < reps; i++) {
    result.push({ type: 'run', durationSec: runSec });
    if (i < reps - 1) {
      result.push({ type: 'recovery', durationSec: recoverySec });
    }
  }
  return result;
}
