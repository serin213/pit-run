/**
 * Live Activity / Dynamic Island 플랫폼 추상화
 *
 * Native iOS 16.1+: ActivityKit (pit-run-live-activity 네이티브 모듈)
 * Android:          no-op
 * Toss 미니앱:      no-op (이 파일만 교체하면 됨)
 *
 * 모듈 레벨에서 현재 활성 activityId를 추적해서, 카운트다운 시점에 미리 시작한
 * LA를 RunningScreen이 재사용할 수 있게 한다 (ActivityKit이 백그라운드 진입 후
 * Activity.request()를 거부하는 문제를 회피).
 */

import {
  startActivity as nativeStart,
  updateActivity as nativeUpdate,
  endActivity as nativeEnd,
  endAllActivities as nativeEndAll,
  isSupported as nativeIsSupported,
} from 'pit-run-live-activity';

export type LiveActivityMode = 'race' | 'qualifying' | 'warmup';

export interface LiveActivityState {
  distKm: number;
  elapsedMs: number;
  paceS: number;
  sector: 'yellow' | 'purple' | 'green';
  tire: 'soft' | 'medium' | 'hard' | 'wet';
  pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';
  prog: number;
  isPaused: boolean;
  // race: prog는 race 진행도, distKm/sector/pitPhase는 정상 race state.
  // qualifying: prog는 1km 진행도 (0~1), elapsedMs는 경과 시간, distKm 미사용.
  // warmup: elapsedMs는 "남은 ms" (카운트다운), prog 미사용.
  // attributes schema는 동일 — elapsedMs 의미만 mode별로 재해석.
  mode: LiveActivityMode;
}

let currentActivityId: string | null = null;

const LA_TAG = '[LiveActivity]';

export function isLiveActivitySupported(): boolean {
  const supported = nativeIsSupported();
  if (__DEV__) console.log(`${LA_TAG} isSupported() →`, supported);
  return supported;
}

export function getCurrentActivityId(): string | null {
  return currentActivityId;
}

/**
 * 이미 활성 activity가 있으면 그 id를 반환하고, 없을 때만 새로 만든다.
 * 카운트다운 진입 시 호출하면 포그라운드 보장 → ActivityKit이 거부하지 않음.
 */
export async function startLiveActivity(
  driverName: string,
  teamColor: string,
  circuitId: string,
  mode: LiveActivityMode = 'race',
): Promise<string | null> {
  if (currentActivityId) {
    if (__DEV__) console.log(`${LA_TAG} start: reusing existing id`, currentActivityId);
    return currentActivityId;
  }
  if (__DEV__) {
    console.log(`${LA_TAG} start: requesting`, { driverName, teamColor, circuitId, mode });
  }
  try {
    const id = await nativeStart(driverName, teamColor, circuitId, mode);
    if (__DEV__) console.log(`${LA_TAG} start: native returned id =`, id);
    currentActivityId = id;
    return id;
  } catch (e) {
    console.warn(`${LA_TAG} start: native threw`, e);
    return null;
  }
}

export async function updateLiveActivity(
  activityId: string,
  state: LiveActivityState,
): Promise<void> {
  try {
    await nativeUpdate(
      activityId,
      state.distKm,
      state.elapsedMs,
      state.paceS,
      state.sector,
      state.tire,
      state.pitPhase,
      state.prog,
      state.isPaused,
      state.mode,
    );
  } catch (e) {
    if (__DEV__) console.warn(`${LA_TAG} update threw`, e);
  }
}

export async function endLiveActivity(activityId: string): Promise<void> {
  try {
    await nativeEnd(activityId);
    if (__DEV__) console.log(`${LA_TAG} end: ok`, activityId);
  } catch (e) {
    console.warn(`${LA_TAG} end threw`, e);
  } finally {
    if (currentActivityId === activityId) {
      currentActivityId = null;
    }
  }
}

/** 앱 강제 종료 / 로그아웃 시 모든 활성 Live Activity 정리 */
export async function endAllLiveActivities(): Promise<void> {
  try {
    await nativeEndAll();
    if (__DEV__) console.log(`${LA_TAG} endAll: ok`);
  } catch (e) {
    console.warn(`${LA_TAG} endAll threw`, e);
  } finally {
    currentActivityId = null;
  }
}
