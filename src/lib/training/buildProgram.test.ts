import { describe, it, expect } from 'vitest';
import {
  buildProgram,
  GRADE_PROFILE,
  type Circuit,
  type User,
} from './buildProgram';

// FIX 4: 일반 인터벌 표준 (400~1200m)에 맞춘 픽스처. 이전 200은 새 MIN_INTERVAL_M(400)에
// 막히면서 clamp 비교 의미 없어짐. 600은 중거리 표준 중앙.
const MODENA: Circuit = { id: 'modena', distanceKm: 5, baseIntervalM: 600, baseReps: 6 };

describe('buildProgram', () => {
  it('F2 user + Modena + medium → correct base program', () => {
    const user: User = {
      trainingBasePace: 360,
      grade: 'f2',
      totalSessionCount: 0,
    };
    const result = buildProgram(user, MODENA, 'medium');

    // intervalM = max(400, min(1200, round(600*1.0))) = 600
    expect(result.intervals.distanceM).toBe(600);
    // rawReps = 6 * 0.8 * 1.0 * 1.0 = 4.8. 묶음 1a recovery max 180으로 줄면서
    // expectedCycleKm 작아짐 → maxFitReps 늘어 5 됨.
    expect(result.intervals.reps).toBe(5);
    // hardPace ≈ 351 (intervalKm 0.6 기준 Riegel)
    expect(result.intervals.hardPace).toBeGreaterThanOrEqual(340);
    expect(result.intervals.hardPace).toBeLessThanOrEqual(360);
    expect(result.recovery.mode).toBe('jog');
    expect(result.cyclePhase).toBe('BASE');
    // expectedCycleDistanceM > intervalM (work + recovery 합산)
    expect(result.totals.expectedCycleDistanceM).toBeGreaterThan(600);
  });

  it('F3 user + Modena + medium → walk recovery (easyPace > 540)', () => {
    const user: User = {
      trainingBasePace: 450,
      grade: 'f3',
      totalSessionCount: 0,
    };
    const result = buildProgram(user, MODENA, 'medium');

    // easyPaceRaw = 450 * 1.30 = 585 > 540
    expect(result.recovery.mode).toBe('walk');
    expect(result.recovery.label).toBe('WALK');
  });

  it('F1 Champion + Modena + soft → PEAK cycle, distanceM 480', () => {
    const user: User = {
      trainingBasePace: 210,
      grade: 'f1_champion',
      totalSessionCount: 2,
    };
    const result = buildProgram(user, MODENA, 'soft');

    // sessionCount 2 % 4 = 2 → PEAK
    expect(result.cyclePhase).toBe('PEAK');
    // FIX 4 픽스처: intervalM = max(400, min(1200, round(600 * 0.80))) = 480
    expect(result.intervals.distanceM).toBe(480);
    // reps는 새 픽스처에서 maxFitReps + repsBounds 영향으로 5
    expect(result.intervals.reps).toBe(5);
  });

  it('totalSessionCount undefined → no crash, BASE cycle', () => {
    const user = {
      trainingBasePace: 360,
      grade: 'f2' as const,
      totalSessionCount: undefined as unknown as number,
    };
    const result = buildProgram(user, MODENA, 'medium');

    expect(result.cyclePhase).toBe('BASE');
  });

  it('F3 + hard tire → reps never exceed 8', () => {
    const grades = ['f3'] as const;
    const baseRepsList = [5, 8, 10, 15, 20, 30];

    for (const baseReps of baseRepsList) {
      for (let session = 0; session < 4; session++) {
        const user: User = {
          trainingBasePace: 400,
          grade: 'f3',
          totalSessionCount: session,
        };
        const circuit: Circuit = {
          id: 'test',
          distanceKm: 5,
          baseIntervalM: 200,
          baseReps,
        };
        const result = buildProgram(user, circuit, 'hard');
        expect(result.intervals.reps).toBeLessThanOrEqual(
          GRADE_PROFILE.f3.repsBounds.max,
        );
      }
    }
  });

  it('min interval distance: baseIntervalM 50 + soft → intervalM >= 400 (FIX 4 clamp)', () => {
    const user: User = {
      trainingBasePace: 360,
      grade: 'f2',
      totalSessionCount: 0,
    };
    const circuit: Circuit = { id: 'tiny', distanceKm: 3, baseIntervalM: 50, baseReps: 10 };
    const result = buildProgram(user, circuit, 'soft');

    // FIX 4: intervalM = max(400, min(1200, round(50 * 0.80))) = max(400, 40) = 400
    expect(result.intervals.distanceM).toBeGreaterThanOrEqual(400);
  });

  it('short circuit → intervalM reduced so MIN_REPS fit', () => {
    // 서킷 2.5km, baseIntervalM 500, hard → 초기 intervalM=600이면 2사이클만 들어감
    // 역산 후 MIN_REPS(4)가 들어오도록 intervalM이 줄어들어야 함
    const user: User = {
      trainingBasePace: 300,
      grade: 'f1',
      totalSessionCount: 0,
    };
    const circuit: Circuit = { id: 'short', distanceKm: 2.5, baseIntervalM: 500, baseReps: 6 };
    const result = buildProgram(user, circuit, 'hard');

    const { distanceM, reps } = result.intervals;
    const { expectedCycleDistanceM } = result.totals;

    // reps × expectedCycleDistanceM ≤ circuit.distanceKm (m 단위)
    expect(reps * expectedCycleDistanceM).toBeLessThanOrEqual(2500 + expectedCycleDistanceM);
    // MIN_REPS가 들어가야 함
    expect(Math.floor(2500 / expectedCycleDistanceM)).toBeGreaterThanOrEqual(4);
    // intervalM은 줄어들어 원래 600보다 작아야 함
    expect(distanceM).toBeLessThan(600);
  });
});
