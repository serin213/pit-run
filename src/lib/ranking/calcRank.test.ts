import { describe, it, expect } from 'vitest';
import {
  determinePhase,
  calcGlobalPercentileFromDistribution,
  calcAppUserPercentile,
  calcPNumber,
  formatPercentile,
  blendPercentile,
  calcQualifyingRank,
  calcRaceRank,
  UNRANKED_LABEL,
  UNRANKED_SUBLABEL,
} from './calcRank';

// ─── determinePhase ───────────────────────────────────────────────────────────

describe('determinePhase', () => {
  it('returns phase1 for counts below 100', () => {
    expect(determinePhase(0)).toBe('phase1');
    expect(determinePhase(50)).toBe('phase1');
    expect(determinePhase(99)).toBe('phase1');
  });

  it('returns phase2 for counts 100–499', () => {
    expect(determinePhase(100)).toBe('phase2');
    expect(determinePhase(300)).toBe('phase2');
    expect(determinePhase(499)).toBe('phase2');
  });

  it('returns phase3 for counts 500 and above', () => {
    expect(determinePhase(500)).toBe('phase3');
    expect(determinePhase(1000)).toBe('phase3');
  });
});

// ─── calcGlobalPercentileFromDistribution ─────────────────────────────────────

describe('calcGlobalPercentileFromDistribution', () => {
  it('returns exact table percentile for table boundary values', () => {
    expect(calcGlobalPercentileFromDistribution(240)).toBe(8);
    expect(calcGlobalPercentileFromDistribution(285)).toBe(25);
  });

  it('linearly interpolates between table entries', () => {
    // midpoint between 240 (p8) and 285 (p25) → 262.5 → ~16.5
    expect(calcGlobalPercentileFromDistribution(262.5)).toBeCloseTo(16.5, 5);
  });

  it('clamps to minimum percentile for pace below table range', () => {
    expect(calcGlobalPercentileFromDistribution(200)).toBe(8);
  });

  it('clamps to maximum percentile for pace above table range', () => {
    expect(calcGlobalPercentileFromDistribution(700)).toBe(99);
  });

  it('throws for pace of 0', () => {
    expect(() => calcGlobalPercentileFromDistribution(0)).toThrow();
  });

  it('throws for negative pace', () => {
    expect(() => calcGlobalPercentileFromDistribution(-10)).toThrow();
  });
});

// ─── calcAppUserPercentile ────────────────────────────────────────────────────

describe('calcAppUserPercentile', () => {
  it('returns 0 for rank 1', () => {
    expect(calcAppUserPercentile(1, 100)).toBe(0);
  });

  it('returns correct percentile for mid-range rank', () => {
    expect(calcAppUserPercentile(50, 100)).toBe(49);
  });

  it('returns 99 for last place (rank == total)', () => {
    expect(calcAppUserPercentile(100, 100)).toBe(99);
  });

  it('returns 0 for rank 1 in pool of 1', () => {
    expect(calcAppUserPercentile(1, 1)).toBe(0);
  });

  it('throws for rank 0', () => {
    expect(() => calcAppUserPercentile(0, 100)).toThrow();
  });

  it('throws for rank exceeding totalInPool', () => {
    expect(() => calcAppUserPercentile(101, 100)).toThrow();
  });

  it('throws for totalInPool of 0', () => {
    expect(() => calcAppUserPercentile(10, 0)).toThrow();
  });
});

// ─── calcPNumber ──────────────────────────────────────────────────────────────

describe('calcPNumber', () => {
  it('returns P1 for rank 1 of 100', () => {
    expect(calcPNumber(1, 100)).toBe(1);
  });

  it('returns P11 for rank 50 of 100', () => {
    expect(calcPNumber(50, 100)).toBe(11);
  });

  it('returns P22 for rank 100 of 100', () => {
    expect(calcPNumber(100, 100)).toBe(22);
  });

  it('returns P1 for rank 1 of 5', () => {
    expect(calcPNumber(1, 5)).toBe(1);
  });

  it('returns P5 for rank 2 of 5', () => {
    expect(calcPNumber(2, 5)).toBe(5);
  });

  it('returns P18 for rank 5 of 5', () => {
    expect(calcPNumber(5, 5)).toBe(18);
  });

  it('returns P1 for rank 1 of 1', () => {
    expect(calcPNumber(1, 1)).toBe(1);
  });

  it('throws for rank 0', () => {
    expect(() => calcPNumber(0, 100)).toThrow();
  });

  it('throws for rank exceeding totalInGradePool', () => {
    expect(() => calcPNumber(101, 100)).toThrow();
  });
});

// ─── formatPercentile ─────────────────────────────────────────────────────────

describe('formatPercentile', () => {
  it('rounds down fractional percentile', () => {
    expect(formatPercentile(42.3)).toBe('TOP 42%');
  });

  it('rounds up fractional percentile', () => {
    expect(formatPercentile(50.5)).toBe('TOP 51%');
  });

  it('handles 0', () => {
    expect(formatPercentile(0)).toBe('TOP 0%');
  });

  it('handles 100', () => {
    expect(formatPercentile(100)).toBe('TOP 100%');
  });

  it('throws for negative percentile', () => {
    expect(() => formatPercentile(-1)).toThrow();
  });

  it('throws for percentile above 100', () => {
    expect(() => formatPercentile(101)).toThrow();
  });
});

// ─── blendPercentile ──────────────────────────────────────────────────────────

describe('blendPercentile', () => {
  it('returns external at boundary (userCount = 100, t = 0)', () => {
    expect(blendPercentile(50, 30, 100)).toBe(50);
  });

  it('returns appUser at boundary (userCount = 500, t = 1)', () => {
    expect(blendPercentile(50, 30, 500)).toBe(30);
  });

  it('returns midpoint blend (userCount = 300, t = 0.5)', () => {
    expect(blendPercentile(50, 30, 300)).toBe(40);
  });

  it('clamps t to 0 when userCount < 100', () => {
    expect(blendPercentile(50, 30, 99)).toBe(50);
  });

  it('clamps t to 1 when userCount > 500', () => {
    expect(blendPercentile(50, 30, 501)).toBe(30);
  });
});

// ─── calcGlobalRankInternal (via calcQualifyingRank) ─────────────────────────

describe('calcGlobalRankInternal (tested via calcQualifyingRank / calcRaceRank)', () => {
  it('Phase 1: uses external distribution only, ignores rank (null)', () => {
    const result = calcQualifyingRank({
      userQualifyingPaceSec: 330,
      userGrade: 'f2',
      totalAppUserCount: 50,
      userRankInGlobalPool: null,
    });
    // paceSec 330 → table entry 45
    expect(result.globalRank.phase).toBe('phase1');
    expect(result.globalRank.isRanked).toBe(true);
    expect(result.globalRank.percentile).toBeCloseTo(45, 5);
  });

  it('Phase 1: ignores userRankInPool even when provided', () => {
    const withRank = calcQualifyingRank({
      userQualifyingPaceSec: 330,
      userGrade: 'f2',
      totalAppUserCount: 50,
      userRankInGlobalPool: 10,
    });
    const withoutRank = calcQualifyingRank({
      userQualifyingPaceSec: 330,
      userGrade: 'f2',
      totalAppUserCount: 50,
      userRankInGlobalPool: null,
    });
    expect(withRank.globalRank.percentile).toBe(withoutRank.globalRank.percentile);
  });

  it('Phase 2: applies blending', () => {
    // paceSec 330 → external 45
    // appUser = (50-1)/300 × 100 = 16.33…
    // t = (300-100)/400 = 0.5
    // blended = 45×0.5 + 16.33×0.5 = 30.67
    const result = calcQualifyingRank({
      userQualifyingPaceSec: 330,
      userGrade: 'f2',
      totalAppUserCount: 300,
      userRankInGlobalPool: 50,
    });
    expect(result.globalRank.phase).toBe('phase2');
    expect(result.globalRank.percentile).toBeCloseTo(30.67, 1);
  });

  it('Phase 2: throws when userRankInPool is null', () => {
    expect(() =>
      calcQualifyingRank({
        userQualifyingPaceSec: 330,
        userGrade: 'f2',
        totalAppUserCount: 300,
        userRankInGlobalPool: null,
      }),
    ).toThrow('Phase 2 requires userRankInPool');
  });

  it('Phase 3: uses app-user percentile only', () => {
    // (100-1)/1000 × 100 = 9.9
    const result = calcQualifyingRank({
      userQualifyingPaceSec: 330,
      userGrade: 'f2',
      totalAppUserCount: 1000,
      userRankInGlobalPool: 100,
    });
    expect(result.globalRank.phase).toBe('phase3');
    expect(result.globalRank.percentile).toBeCloseTo(9.9, 5);
  });

  it('Phase 3: throws when userRankInPool is null', () => {
    expect(() =>
      calcQualifyingRank({
        userQualifyingPaceSec: 330,
        userGrade: 'f2',
        totalAppUserCount: 1000,
        userRankInGlobalPool: null,
      }),
    ).toThrow();
  });
});

// ─── calcQualifyingRank ───────────────────────────────────────────────────────

describe('calcQualifyingRank', () => {
  it('Phase 1 F2 user: globalRank is ranked with TOP X% label', () => {
    const result = calcQualifyingRank({
      userQualifyingPaceSec: 330,
      userGrade: 'f2',
      totalAppUserCount: 50,
      userRankInGlobalPool: null,
    });
    expect(result.globalRank.phase).toBe('phase1');
    expect(result.globalRank.isRanked).toBe(true);
    expect(result.globalRank.displayLabel).toMatch(/^TOP \d+%$/);
  });

  it('result does not have a gradeRank field', () => {
    const result = calcQualifyingRank({
      userQualifyingPaceSec: 330,
      userGrade: 'f2',
      totalAppUserCount: 50,
      userRankInGlobalPool: null,
    });
    expect('gradeRank' in result).toBe(false);
  });
});

// ─── calcRaceRank ─────────────────────────────────────────────────────────────

describe('calcRaceRank', () => {
  const baseInput = {
    userHardAveragePaceSec: 360,
    userGrade: 'f2' as const,
    circuitId: 'modena',
    tire: 'medium' as const,
    completedAt: 1_700_000_000,
    completedReps: 8,
    plannedReps: 8,
    poolTotalCount: 50,
    poolGradeCount: 30,
    userRankInPool: null,   // phase1, rank ignored
    userRankInGradePool: 10,
  };

  it('normal case: globalRank and gradeRank are ranked, isLocked is true', () => {
    const result = calcRaceRank(baseInput);
    expect(result.globalRank.isRanked).toBe(true);
    expect(result.gradeRank.isRanked).toBe(true);
    expect(result.isLocked).toBe(true);
  });

  it('normal case: gradeRank pNumber is P7', () => {
    // rank 10 of 30 → percentile = 9/30×100 = 30 → pNumber = ceil(30×22/100) = ceil(6.6) = 7
    const result = calcRaceRank(baseInput);
    expect(result.gradeRank.pNumber).toBe(7);
    expect(result.gradeRank.displayLabel).toBe('P7');
  });

  it('retire case: completedReps < plannedReps → both UNRANKED', () => {
    const result = calcRaceRank({ ...baseInput, completedReps: 5, plannedReps: 8 });
    expect(result.globalRank.isRanked).toBe(false);
    expect(result.globalRank.displayLabel).toBe(UNRANKED_LABEL);
    expect(result.globalRank.subLabel).toBe('완주한 레이스만 랭킹에 포함돼요');
    expect(result.gradeRank.isRanked).toBe(false);
    expect(result.gradeRank.displayLabel).toBe(UNRANKED_LABEL);
    expect(result.gradeRank.subLabel).toBe('완주한 레이스만 랭킹에 포함돼요');
    expect(result.isLocked).toBe(true);
  });

  it('grade pool below MIN (9): gradeRank UNRANKED, globalRank still calculated', () => {
    const result = calcRaceRank({
      ...baseInput,
      poolGradeCount: 9,
      userRankInGradePool: 3,
    });
    expect(result.gradeRank.isRanked).toBe(false);
    expect(result.gradeRank.displayLabel).toBe(UNRANKED_LABEL);
    expect(result.gradeRank.subLabel).toBe(UNRANKED_SUBLABEL);
    expect(result.globalRank.isRanked).toBe(true);
  });

  it('throws when poolGradeCount exceeds poolTotalCount', () => {
    expect(() =>
      calcRaceRank({ ...baseInput, poolGradeCount: 60, poolTotalCount: 50 }),
    ).toThrow('poolGradeCount cannot exceed poolTotalCount');
  });

  it('throws when userRankInGradePool exceeds poolGradeCount', () => {
    expect(() =>
      calcRaceRank({ ...baseInput, userRankInGradePool: 35, poolGradeCount: 30 }),
    ).toThrow('userRankInGradePool cannot exceed poolGradeCount');
  });
});
