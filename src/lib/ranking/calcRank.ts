import type {
  RankPhase,
  RankResult,
  QualifyingRankInput,
  QualifyingRankResult,
  RaceRankInput,
  RaceRankResult,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const PHASE_THRESHOLDS = {
  phase1Max: 100,
  phase3Min: 500,
} as const;

export const MIN_USERS_FOR_GRADE_RANK = 10;
export const P_NUMBER_MAX = 22;
export const UNRANKED_LABEL = 'UNRANKED';
export const UNRANKED_SUBLABEL = '10명이 모이면 랭크가 공개돼요';

/**
 * 전체 러너 페이스 분포 테이블.
 * paceSec(sec/km) → percentile(상위 %, 낮을수록 빠름).
 *
 * TODO: 베타 데이터 누적 후 recalculateFromDistribution으로 재산정
 * TODO: 현재 성별 미구분. 베타 데이터 분석 시 여성 유저 등급 분포 확인 후
 *       젠더별 테이블 도입 여부 검토
 * TODO: 블렌딩 곡선 검토 (현재 선형, 로그/시그모이드 가능)
 */
export const GLOBAL_RUNNER_PACE_DISTRIBUTION: ReadonlyArray<{
  paceSec: number;
  percentile: number;
}> = [
  { paceSec: 240, percentile: 8  }, // 4:00/km
  { paceSec: 285, percentile: 25 }, // 4:45/km
  { paceSec: 330, percentile: 45 }, // 5:30/km
  { paceSec: 390, percentile: 75 }, // 6:30/km
  { paceSec: 420, percentile: 88 }, // 7:00/km
  { paceSec: 600, percentile: 99 }, // 10:00/km
];

// ─── Helper functions ─────────────────────────────────────────────────────────

export function determinePhase(userCount: number): RankPhase {
  if (userCount < PHASE_THRESHOLDS.phase1Max) return 'phase1';
  if (userCount < PHASE_THRESHOLDS.phase3Min) return 'phase2';
  return 'phase3';
}

/**
 * 전체 러너 분포 테이블에서 선형 보간으로 상위 % 반환.
 * paceSec이 테이블 범위 밖이면 경계값의 percentile을 그대로 반환.
 */
export function calcGlobalPercentileFromDistribution(paceSec: number): number {
  if (paceSec <= 0) {
    throw new Error('Invalid pace: paceSec must be greater than 0');
  }

  const table = GLOBAL_RUNNER_PACE_DISTRIBUTION;
  const first = table[0];
  const last  = table[table.length - 1];

  if (paceSec <= first.paceSec) return first.percentile;
  if (paceSec >= last.paceSec)  return last.percentile;

  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i];
    const hi = table[i + 1];
    if (paceSec >= lo.paceSec && paceSec <= hi.paceSec) {
      const t = (paceSec - lo.paceSec) / (hi.paceSec - lo.paceSec);
      return lo.percentile + t * (hi.percentile - lo.percentile);
    }
  }

  // 도달 불가 (경계 처리로 커버됨)
  return last.percentile;
}

/**
 * 앱 유저 풀 내 순위로 상위 % 계산.
 * 수식: (userRank - 1) / totalInPool × 100
 */
export function calcAppUserPercentile(
  userRank: number,
  totalInPool: number,
): number {
  if (totalInPool <= 0) {
    throw new Error('Invalid totalInPool: must be greater than 0');
  }
  if (userRank < 1 || userRank > totalInPool) {
    throw new Error(
      `Invalid userRank: must be between 1 and totalInPool (${totalInPool}), got ${userRank}`,
    );
  }
  return ((userRank - 1) / totalInPool) * 100;
}

/**
 * Phase 2 블렌딩: 외부 분포와 앱 유저 데이터를 선형 보간.
 * t = clamp((userCount - 100) / 400, 0, 1)
 * result = external × (1 - t) + appUser × t
 */
export function blendPercentile(
  external: number,
  appUser: number,
  userCount: number,
): number {
  const t = Math.max(0, Math.min(1, (userCount - 100) / 400));
  return external * (1 - t) + appUser * t;
}

/** percentile을 정수 반올림해서 "TOP {n}%" 반환 */
export function formatPercentile(percentile: number): string {
  if (percentile < 0 || percentile > 100) {
    throw new Error(
      `Invalid percentile: must be between 0 and 100, got ${percentile}`,
    );
  }
  return `TOP ${Math.round(percentile)}%`;
}

/**
 * 등급 풀 내 순위로 P1~P22 번호 계산.
 *
 * TODO: 상위 5% 이하 유저는 모두 P1로 표시됨.
 *       엘리트 차별화는 베타 데이터 확인 후 보강 검토
 */
export function calcPNumber(
  userRankInGrade: number,
  totalInGradePool: number,
): number {
  if (totalInGradePool <= 0) {
    throw new Error('Invalid totalInGradePool: must be greater than 0');
  }
  if (userRankInGrade < 1 || userRankInGrade > totalInGradePool) {
    throw new Error(
      `Invalid userRankInGrade: must be between 1 and totalInGradePool (${totalInGradePool}), got ${userRankInGrade}`,
    );
  }
  const percentile = ((userRankInGrade - 1) / totalInGradePool) * 100;
  const pNumber    = Math.ceil((percentile * P_NUMBER_MAX) / 100);
  return Math.max(1, Math.min(P_NUMBER_MAX, pNumber));
}

/**
 * 글로벌 랭크 percentile (0~100, 상위 %) → P1~P22 매핑.
 * 베타 단계에서 등급 풀이 작아 P넘버를 산출할 수 없을 때 글로벌 랭크 기반
 * 시각화에 사용. 정식 출시 후에도 동일 매핑 유지 가능.
 *
 * 예: TOP 5% → P2, TOP 50% → P11, TOP 95% → P21
 */
export function percentileToPNumber(percentile: number): number {
  if (percentile < 0 || percentile > 100) {
    throw new Error(
      `Invalid percentile: must be between 0 and 100, got ${percentile}`,
    );
  }
  const p = Math.ceil((percentile / 100) * P_NUMBER_MAX);
  return Math.max(1, Math.min(P_NUMBER_MAX, p));
}

/** UNRANKED RankResult 공통 생성 헬퍼 */
export function buildUnrankedResult(subLabel?: string): RankResult {
  return {
    isRanked:     false,
    percentile:   null,
    pNumber:      null,
    totalInPool:  0,
    phase:        null,
    displayLabel: UNRANKED_LABEL,
    subLabel:     subLabel ?? UNRANKED_SUBLABEL,
  };
}

// ─── Internal shared logic ────────────────────────────────────────────────────

/**
 * 글로벌 랭크 계산 공통 내부 함수.
 * Phase에 따라 외부 분포 단독 / 블렌딩 / 앱 유저 단독으로 percentile 산출.
 */
function calcGlobalRankInternal(
  userPaceSec: number,
  userRankInPool: number | null,
  totalPoolCount: number,
): RankResult {
  const phase = determinePhase(totalPoolCount);

  let percentile: number;

  if (phase === 'phase1') {
    // Phase 1: 외부 분포만 사용. userRankInPool 무시.
    // Phase 2 경계에서 연속성을 보장하기 위해 앱 유저 순위 반영하지 않음.
    percentile = calcGlobalPercentileFromDistribution(userPaceSec);
  } else if (phase === 'phase2') {
    if (userRankInPool === null) {
      throw new Error('Phase 2 requires userRankInPool');
    }
    const external = calcGlobalPercentileFromDistribution(userPaceSec);
    const appUser  = calcAppUserPercentile(userRankInPool, totalPoolCount);
    percentile = blendPercentile(external, appUser, totalPoolCount);
  } else {
    // phase3
    if (userRankInPool === null) {
      throw new Error('Phase 3 requires userRankInPool');
    }
    percentile = calcAppUserPercentile(userRankInPool, totalPoolCount);
  }

  return {
    isRanked:     true,
    percentile,
    pNumber:      null,
    totalInPool:  totalPoolCount,
    phase,
    displayLabel: formatPercentile(percentile),
    subLabel:     null,
  };
}

// ─── Main functions ───────────────────────────────────────────────────────────

/**
 * 퀄리파잉 랭크 계산.
 * 등급별 랭크는 계산하지 않음 (옵션 A).
 */
export function calcQualifyingRank(
  input: QualifyingRankInput,
): QualifyingRankResult {
  const globalRank = calcGlobalRankInternal(
    input.userQualifyingPaceSec,
    input.userRankInGlobalPool,
    input.totalAppUserCount,
  );
  return { globalRank };
}

/**
 * 레이스 랭크 계산.
 *
 * 1. Retire 검증: completedReps < plannedReps → UNRANKED
 * 2. 방어적 검증: 풀 카운트 논리 오류 체크
 * 3. 글로벌 랭크: calcGlobalRankInternal
 * 4. 등급별 랭크: poolGradeCount 충족 시 P번호 계산, 미충족 시 UNRANKED
 */
export function calcRaceRank(input: RaceRankInput): RaceRankResult {
  // 1단계: Retire 검증
  if (input.completedReps < input.plannedReps) {
    const retireLabel = '완주한 레이스만 랭킹에 포함돼요';
    return {
      globalRank: buildUnrankedResult(retireLabel),
      gradeRank:  buildUnrankedResult(retireLabel),
      isLocked:   true,
    };
  }

  // 2단계: 방어적 검증
  if (input.poolGradeCount > input.poolTotalCount) {
    throw new Error('poolGradeCount cannot exceed poolTotalCount');
  }
  if (input.userRankInGradePool > input.poolGradeCount) {
    throw new Error('userRankInGradePool cannot exceed poolGradeCount');
  }

  // 3단계: 글로벌 랭크
  const globalRank = calcGlobalRankInternal(
    input.userHardAveragePaceSec,
    input.userRankInPool,
    input.poolTotalCount,
  );

  // 4단계: 등급별 랭크
  let gradeRank: RankResult;
  if (input.poolGradeCount < MIN_USERS_FOR_GRADE_RANK) {
    gradeRank = buildUnrankedResult();
  } else {
    const pNumber = calcPNumber(input.userRankInGradePool, input.poolGradeCount);
    gradeRank = {
      isRanked:     true,
      percentile:   null,
      pNumber,
      totalInPool:  input.poolGradeCount,
      phase:        null,
      displayLabel: `P${pNumber}`,
      subLabel:     null,
    };
  }

  // 5단계: 반환
  return { globalRank, gradeRank, isLocked: true };
}

// ─── Server integration guide ─────────────────────────────────────────────────
/*
 * 다음 함수들은 서버/DB 연동이 필요하므로 추후 백엔드 작업에서 구현.
 *
 * 1. getUserRankInGlobalPool(userId)
 *    퀄리파잉 페이스 기준 전체 유저 중 본인 순위.
 *    Phase 2+ 진입 후 필수.
 *
 * 2. getUserRankInRacePool(userId, circuitId, tire)
 *    서킷×타이어 풀 내 Hard 평균 페이스 기준 본인 순위.
 *    레이스 완주 시점에 한 번만 계산 후 스냅샷으로 저장.
 *
 * 3. getUserRankInGradePool(userId, circuitId, tire, grade)
 *    서킷×타이어×등급 풀 내 본인 순위.
 *    레이스 완주 시점 계산.
 *
 * 4. batchRecalculateGlobalDistribution()
 *    하루 1회 배치. 전체 유저 페이스 분포 재계산.
 *    GLOBAL_RUNNER_PACE_DISTRIBUTION 동적 업데이트.
 *
 * 5. saveRaceRankSnapshot(raceId, rankResult)
 *    완주 직후 계산된 랭크를 DB 스냅샷 저장.
 *    이후 재집계 없이 스냅샷만 반환 (isLocked: true 원칙).
 */

/*
 * Hard 평균 페이스 계산 — 호출자 가이드.
 *
 * 레이스 완주 시 클라이언트가 calcRaceRank 호출 전 계산해야 함.
 *
 *   const hardSegments        = raceLog.filter(s => s.type === 'hard');
 *   const totalHardDistanceKm = hardSegments.reduce((sum, s) => sum + s.distanceM, 0) / 1000;
 *   const totalHardDurationSec = hardSegments.reduce((sum, s) => sum + s.durationSec, 0);
 *   const userHardAveragePaceSec = totalHardDurationSec / totalHardDistanceKm;
 *
 * 거리 가중 평균 방식이며 단순 평균 아님.
 */
