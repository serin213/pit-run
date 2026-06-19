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
  /**
   * 'race' (grand prix) — boxbox/fullPush 사이클 적용.
   * 'qualifying' — intervalKm(=1) 도달 시 qualifyingEnd 사운드 한 번만 발화.
   *                boxbox/fullPush 로직 무관.
   */
  mode: 'race' | 'qualifying';
  /**
   * race가 실제로 진행 중인지 여부 — background task 이중 안전망.
   * 정상 흐름은 clearActiveRacePlan으로 전체 plan을 지우므로 이 필드는 redundant하지만,
   * 앱 swipe kill 등 비정상 종료로 plan이 stale로 남는 경우를 막기 위해 명시적 가드.
   * - race/qualifying 시작 시: true
   * - clear 호출되면 plan 자체가 사라져 첫 줄 null check에서 잡힘
   * - cleanupStaleBackgroundTask에서 false로 명시적 patch 가능
   */
  isRunning: boolean;
  /**
   * measurement lifecycle 상태 동기화 필드.
   * - pauseRun: isPaused=true 저장 후 background location task를 내림
   * - resumeRun: isPaused=false 저장 후 RunningScreen/useGPS가 task를 새 baseline으로 재시작
   * - background callback의 isPaused 체크는 stop 직전 이미 들어온 callback용 safety net
   * - 시작 시 false
   */
  isPaused: boolean;
  /** race/qualifying 시작 시각 (Date.now()) — 진단 용도 */
  startedAtMs: number;
  /** race: 한 work 사이클 거리. qualifying: 완료 거리(1km). */
  intervalKm: number;
  /** race: 회복 시간 (ms). qualifying: 사용 안 함 (0). */
  recoveryDurationMs: number;
  /** race: 총 인터벌 반복 횟수. qualifying: 1. */
  maxReps: number;
  /** race: 직전 boxbox 발화 위치. qualifying: 사용 안 함 (0). */
  lastBoxBoxAtKm: number;
  /**
   * race: 완료한 boxbox 사이클 수.
   * qualifying: 0이면 미완료, 1이면 qualifyingEnd 사운드 발화 완료.
   */
  completedReps: number;
  /**
   * race: 예약된 fullPush 발화 시각. qualifying: 항상 null.
   */
  nextFullPushAtMs: number | null;

  /**
   * race: 예약된 box-box 발화 시각 (work 구간 중). 시간 기준 트리거.
   * work 시작 시 now + predictedWorkMs로 설정, box-box 발화 시 null(회복 진입),
   * fullPush 발화(work 재시작) 시 다시 now + predictedWorkMs로 재설정.
   * 거리 기준(workKm>=intervalKm)을 시간 기준(now>=nextBoxBoxAtMs)으로 대체 —
   * 엔진음 keep-alive로 앱이 살아있어 자체 1초 평가로 정시 발화 가능. qualifying: null.
   */
  nextBoxBoxAtMs: number | null;

  /**
   * race: work 1회 예상 소요 시간(ms). box-box/work 재예약에 사용.
   * activePlan: intervalKm × intervals.hardPace × 1000. free-run: intervalKm ×
   * qualifyingResult.paceSecPerKm × 1000 (예선 고정 페이스). qualifying: 0.
   */
  predictedWorkMs: number;

  /**
   * 묶음 2: alert 단계 동기화 필드.
   * background가 발화한 직후 foreground polling이 'boxbox'/'fullPush' alert phase를
   * derive할 수 있게 표시. 발화 후 4초(ALERT_MS) 이내면 alert phase로 표시.
   */
  lastFiredAt: 'boxbox' | 'fullPush' | null;
  lastFiredAtMs: number | null;

  /**
   * 묶음 2: lap segment timing 필드.
   * background에서 lap/pit segment의 duration·distM 계산용. foreground RAF에서
   * 추적하던 lapStartKmRef/lapStartMsRef를 background로 이전.
   * - workStartedAtMs / workStartedAtKm: 직전 회복 종료(또는 race 시작) 시점
   * - pitStartedAtMs / pitStartedAtKm: 직전 boxbox 발화 시점
   */
  workStartedAtMs: number;
  workStartedAtKm: number;
  pitStartedAtMs: number | null;
  pitStartedAtKm: number | null;

  /** race: 전체 서킷 거리. background finish/final-lap 판정용. */
  circuitKm?: number;
  /** race: final lap 진입 판정에 쓰는 예상 1사이클 거리. */
  expectedCycleM?: number;
  /** background에서 finalLap 사운드를 이미 발화했는지. */
  finalLapFired?: boolean;
  /** background에서 finish 사운드를 이미 발화했는지. */
  finishFired?: boolean;
  /** race pause 시작 시각. resume 때 wall-clock timer들을 이 기간만큼 뒤로 민다. */
  pausedAtMs?: number | null;
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
