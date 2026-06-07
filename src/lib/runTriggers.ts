/**
 * Pure trigger helpers — React/React-Native 의존 없음.
 * useRunning.ts 내부 로직과 단위 테스트 양쪽에서 사용.
 */

/** work 구간 진행 거리 = 현재 누적거리 - 마지막 회복 종료 시점 누적거리 */
export function calcWorkKm(distKm: number, workStartKm: number): number {
  return distKm - workStartKm;
}

/**
 * BoxBox 트리거 조건 순수 판정.
 * phase, count, distance 세 가지 가드를 통과해야 true.
 */
export function shouldTriggerBoxBox(params: {
  phase: string;
  triggerCount: number;
  maxReps: number;
  distKm: number;
  workStartKm: number;
  intervalKm: number;
  /** FIX 8: 최종 랩 진입 후엔 boxbox 사이클 절대 시작 안 함. true면 즉시 false 반환. */
  isFinalLap?: boolean;
}): boolean {
  const { phase, triggerCount, maxReps, distKm, workStartKm, intervalKm, isFinalLap } = params;
  // FIX 8: 최종 랩 진입했으면 회복 사이클 시작 금지 — 사용자가 끝까지 work로 달려야.
  // useRunning의 isFinalLap 분기가 boxbox 안 띄우는 게 정상이지만, 경계 케이스
  // (회복 종료 직후 final lap 트리거)에서 한 사이클 더 발화 가능 → 여기서 차단.
  if (isFinalLap === true) return false;
  if (phase !== 'none') return false;
  if (triggerCount >= maxReps) return false;
  return distKm - workStartKm >= intervalKm;
}

/**
 * 주판정: 회복 종료 시 남은 거리가 1사이클 이하 → 최종 랩
 */
export function shouldFireFinalLap(params: {
  distKm: number;
  circuitKm: number;
  expectedCycleM: number;
}): boolean {
  const remainingM = (params.circuitKm - params.distKm) * 1000;
  return remainingM <= params.expectedCycleM;
}

/**
 * 안전망: 주판정을 놓친 경우 work 진행 중 거리 기준 최종 랩 판정
 */
export function shouldFireFinalLapSafety(params: {
  distKm: number;
  circuitKm: number;
  intervalKm: number;
}): boolean {
  return params.distKm > params.circuitKm - params.intervalKm;
}
