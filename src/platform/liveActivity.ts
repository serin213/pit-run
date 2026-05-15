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

export interface LiveActivityState {
  distKm: number;
  elapsedMs: number;
  paceS: number;
  sector: 'yellow' | 'purple' | 'green';
  tire: 'soft' | 'medium' | 'hard' | 'wet';
  pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';
  prog: number;
  isPaused: boolean;
}

let currentActivityId: string | null = null;

export function isLiveActivitySupported(): boolean {
  return nativeIsSupported();
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
): Promise<string | null> {
  if (currentActivityId) return currentActivityId;
  try {
    const id = await nativeStart(driverName, teamColor, circuitId);
    currentActivityId = id;
    return id;
  } catch (e) {
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
    );
  } catch {}
}

export async function endLiveActivity(activityId: string): Promise<void> {
  try {
    await nativeEnd(activityId);
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
  } finally {
    currentActivityId = null;
  }
}
