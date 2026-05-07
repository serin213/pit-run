/**
 * Live Activity / Dynamic Island 플랫폼 추상화
 *
 * Native iOS 16.1+: ActivityKit (pit-run-live-activity 네이티브 모듈)
 * Android:          no-op (네이티브 모듈이 자동으로 처리)
 * Toss 미니앱:      no-op (이 파일만 교체하면 됨)
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
  tire: 'soft' | 'medium' | 'hard';
  pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush';
}

export function isLiveActivitySupported(): boolean {
  return nativeIsSupported();
}

export async function startLiveActivity(
  driverName: string,
  teamColor: string,
): Promise<string | null> {
  return nativeStart(driverName, teamColor);
}

export async function updateLiveActivity(
  activityId: string,
  state: LiveActivityState,
): Promise<void> {
  return nativeUpdate(
    activityId,
    state.distKm,
    state.elapsedMs,
    state.paceS,
    state.sector,
    state.tire,
    state.pitPhase,
  );
}

export async function endLiveActivity(activityId: string): Promise<void> {
  return nativeEnd(activityId);
}

/** 앱 강제 종료 / 로그아웃 시 모든 활성 Live Activity 정리 */
export async function endAllLiveActivities(): Promise<void> {
  return nativeEndAll();
}
