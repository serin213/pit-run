// ─── Domain union types ────────────────────────────────────────────────────────

import type { Grade } from '../../types/qualifying';
export type { Grade };

export type Tire = 'soft' | 'medium' | 'hard';

/**
 * phase1: 전체 러너 통계 기반 (앱 유저 100명 미만)
 * phase2: 외부 분포 ↔ 앱 유저 데이터 블렌딩 (100~499명)
 * phase3: 앱 유저 기반 (500명 이상)
 */
export type RankPhase = 'phase1' | 'phase2' | 'phase3';

// ─── Shared result type ───────────────────────────────────────────────────────

/**
 * 글로벌/등급별 랭크 공용 타입.
 * - percentile : 0~100, 상위 % (계산 불가 시 null)
 * - pNumber    : P1~P22, 등급별 랭크에만 해당 (글로벌에선 null)
 * - phase      : 글로벌 랭크에만 해당 (등급별에선 null)
 */
export interface RankResult {
  isRanked: boolean;
  percentile: number | null;
  pNumber: number | null;
  totalInPool: number;
  phase: RankPhase | null;
  displayLabel: string;
  subLabel: string | null;
}

// ─── Qualifying rank ──────────────────────────────────────────────────────────

export interface QualifyingRankInput {
  userQualifyingPaceSec: number;
  userGrade: Grade;
  totalAppUserCount: number;
  /** Phase 1에선 null 허용, Phase 2/3에선 필수 */
  userRankInGlobalPool: number | null;
}

export interface QualifyingRankResult {
  globalRank: RankResult;
}

// ─── Race rank ────────────────────────────────────────────────────────────────

export interface RaceRankInput {
  /** Hard 구간들의 거리 가중 평균 페이스 (sec/km) */
  userHardAveragePaceSec: number;
  userGrade: Grade;
  circuitId: string;
  tire: Tire;
  completedAt: number;
  /** 실제 완주한 인터벌 수 */
  completedReps: number;
  /** 프로그램이 설정한 인터벌 수 */
  plannedReps: number;
  /** 같은 서킷×타이어 완주한 전체 유저 수 */
  poolTotalCount: number;
  /** 같은 서킷×타이어×등급 완주 유저 수 */
  poolGradeCount: number;
  /** Phase 2/3에서 필수 */
  userRankInPool: number | null;
  /** 등급 풀 내 본인 순위 (1-indexed) */
  userRankInGradePool: number;
}

export interface RaceRankResult {
  globalRank: RankResult;
  gradeRank: RankResult;
  isLocked: true;
}
