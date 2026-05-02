import { calculateGrade } from '../../core/qualifying';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Grade = 'f3' | 'f2' | 'f1_rookie' | 'f1' | 'f1_champion';

export type GradeTier = {
  grade: Grade;
  /** 이 페이스 이상이면 이 등급 (sec/km) */
  minPaceSec: number;
  /** 이 페이스 미만, null이면 무제한 빠름 */
  maxPaceSec: number | null;
  /** 현재는 참고용. 추후 분포 기반 재산정에 사용 */
  targetPercentile: { min: number; max: number };
};

export type GradeAssignment = {
  grade: Grade;
  assignedAt: number;
  /** 등급 산정 시 사용된 페이스 (sec/km) */
  qualifyingTime1km: number;
  /** F1 계열은 90일 후, 그 외는 null */
  expiresAt: number | null;
  /** 계산된 값 */
  isExpired: boolean;
  /** 계산된 값. F1 계열이고 expiresAt 지났으면 true */
  requiresReQualifying: boolean;
};

// ─── Constants (Remote Config 외부 주입 예정) ──────────────────────────────────

export const GRADE_TIERS: readonly GradeTier[] = [
  {
    grade: 'f1_champion',
    minPaceSec: 0,
    maxPaceSec: 240,
    targetPercentile: { min: 0, max: 5 },
  },
  {
    grade: 'f1',
    minPaceSec: 240,
    maxPaceSec: 270,
    targetPercentile: { min: 5, max: 20 },
  },
  {
    grade: 'f1_rookie',
    minPaceSec: 270,
    maxPaceSec: 330,
    targetPercentile: { min: 20, max: 38 },
  },
  {
    grade: 'f2',
    minPaceSec: 330,
    maxPaceSec: 390,
    targetPercentile: { min: 38, max: 72 },
  },
  {
    grade: 'f3',
    minPaceSec: 390,
    maxPaceSec: null,
    targetPercentile: { min: 72, max: 100 },
  },
] as const;

/** 재퀄리파잉 강제 대상 등급 */
export const F1_GRADES: readonly Grade[] = ['f1_rookie', 'f1', 'f1_champion'] as const;

export const REQUALIFYING_INTERVAL_DAYS = 90;
export const REQUALIFYING_INTERVAL_MS =
  REQUALIFYING_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

/** 월챔은 항상 상위 5% 이내 유지. 추후 강등 로직에서 사용 */
export const CHAMPION_PERCENTILE_CAP = 5;

// ─── Functions ────────────────────────────────────────────────────────────────

/** 1km 퀄리파잉 페이스(sec/km)로 등급 산정. 기준은 core/qualifying.ts 단일 진실 공급원. */
export function calcGradeFromPace(qualifyingTime1km: number): Grade {
  if (qualifyingTime1km <= 0) {
    throw new Error('Invalid qualifying time');
  }
  return calculateGrade(qualifyingTime1km * 1000);
}

/**
 * 등급 산정 결과를 GradeAssignment plain object로 반환.
 * F1 계열(f1_rookie, f1, f1_champion)은 90일 후 만료.
 */
export function assignGrade(
  qualifyingTime1km: number,
  now: number = Date.now(),
): GradeAssignment {
  const grade = calcGradeFromPace(qualifyingTime1km);
  const isF1Grade = (F1_GRADES as readonly string[]).includes(grade);
  const expiresAt = isF1Grade ? now + REQUALIFYING_INTERVAL_MS : null;
  const expired = isGradeExpired({ grade, assignedAt: now, qualifyingTime1km, expiresAt, isExpired: false, requiresReQualifying: false }, now);
  const reQual = requiresReQualifying({ grade, assignedAt: now, qualifyingTime1km, expiresAt, isExpired: expired, requiresReQualifying: false }, now);

  return {
    grade,
    assignedAt: now,
    qualifyingTime1km,
    expiresAt,
    isExpired: expired,
    requiresReQualifying: reQual,
  };
}

/**
 * expiresAt이 null이면 false.
 * now가 expiresAt 이후면 true.
 */
export function isGradeExpired(
  assignment: GradeAssignment,
  now: number = Date.now(),
): boolean {
  if (assignment.expiresAt === null) return false;
  return now >= assignment.expiresAt;
}

/**
 * F1_GRADES에 포함되고 만료됐으면 true.
 */
export function requiresReQualifying(
  assignment: GradeAssignment,
  now: number = Date.now(),
): boolean {
  if (!(F1_GRADES as readonly string[]).includes(assignment.grade)) return false;
  return isGradeExpired(assignment, now);
}

/**
 * 등급 만료까지 남은 일수. 양수면 남은 일수, 음수면 만료된 일수.
 * expiresAt이 null이면 null 반환.
 */
export function getDaysUntilExpiry(
  assignment: GradeAssignment,
  now: number = Date.now(),
): number | null {
  if (assignment.expiresAt === null) return null;
  const diffMs = assignment.expiresAt - now;
  return diffMs / (24 * 60 * 60 * 1000);
}

// ─── 2단계 구현용 stubs ────────────────────────────────────────────────────────

/**
 * TODO: 월챔 등급 인원이 전체 유저의 5% 초과 시, 가장 느린 월챔 유저를
 * F1으로 강등시키는 판정 로직. 베타 데이터 모인 후 구현.
 * CHAMPION_PERCENTILE_CAP 상수 사용.
 */
export function shouldDemoteFromChampion(
  _allUsersChampionPaces: number[],
  _userPace: number,
): boolean {
  throw new Error('Not implemented yet');
}

/**
 * TODO: 실제 유저 분포 기반으로 GRADE_TIERS의 경계값을 재계산.
 * 현재는 이론값 사용. 베타 1000명 이상 누적 후 구현.
 * targetPercentile 기준으로 동적 산출.
 */
export function recalculateTiersFromDistribution(
  _allUserPaces: number[],
): GradeTier[] {
  throw new Error('Not implemented yet');
}
