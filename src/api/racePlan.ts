/**
 * Active race plan — MMKV에 저장되는 실시간 race 상태.
 *
 * 목적: background location task callback (foreground와 별도 JS context)에서도
 *       race 진행 상황 알 수 있게 공유. boxbox / fullPush 사운드를 background
 *       에서도 적절한 시점에 발화하기 위함.
 *
 * 정책:
 *   - race 시작 시 useRunning이 setActiveRacePlan() 호출
 *   - background task가 distance 누적 후 매번 plan 읽어 interval 도달 / fullPush
 *     시점 체크 → playSound() 발화 → plan 업데이트 (lastBoxBoxAtKm 등)
 *   - foreground useRunning이 store distKm 변경 시 plan.lastBoxBoxAtKm 읽어
 *     workStartKmRef 동기화 → 중복 boxbox 발화 차단
 *   - race 종료 시 clearActiveRacePlan() 호출
 */

import { getString, setString, remove } from '../platform/storage';

const KEY = 'active_race_plan_v1';

export type ActiveRacePlan = {
  /** race 시작 시각 (Date.now()) — 진단 용도 */
  startedAtMs: number;
  /** 한 work 사이클 거리 (km). 이 거리만큼 뛰면 boxbox 발화. */
  intervalKm: number;
  /** 회복 시간 (ms). boxbox 발화 4초 후부터 카운트되어 fullPush 발화. */
  recoveryDurationMs: number;
  /** 총 인터벌 반복 횟수. completedReps가 이 값에 도달하면 더 이상 boxbox 발화 안 함. */
  maxReps: number;
  /** 직전 boxbox 발화 위치 (누적 km). 다음 boxbox는 이 값 + intervalKm에서 발화. */
  lastBoxBoxAtKm: number;
  /** 완료한 boxbox 사이클 수 */
  completedReps: number;
  /**
   * 예약된 fullPush 발화 시각 (Date.now() + 4000 + recoveryDurationMs).
   * background task가 매 callback에서 Date.now()와 비교, 시점 도래 시 발화.
   * null이면 현재 boxbox 사이클 진행 중이 아님 (work 페이즈).
   */
  nextFullPushAtMs: number | null;
};

export function getActiveRacePlan(): ActiveRacePlan | null {
  const raw = getString(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as ActiveRacePlan; }
  catch { return null; }
}

export function setActiveRacePlan(plan: ActiveRacePlan): void {
  setString(KEY, JSON.stringify(plan));
}

export function updateActiveRacePlan(patch: Partial<ActiveRacePlan>): ActiveRacePlan | null {
  const current = getActiveRacePlan();
  if (!current) return null;
  const next = { ...current, ...patch };
  setString(KEY, JSON.stringify(next));
  return next;
}

export function clearActiveRacePlan(): void {
  remove(KEY);
}
