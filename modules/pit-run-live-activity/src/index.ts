import { requireOptionalNativeModule, Platform, type EventSubscription } from 'expo-modules-core';

/** APNs Live Activity push 토큰 갱신 이벤트 payload (네이티브 onLiveActivityPushToken). */
export interface LiveActivityPushTokenEvent {
  activityId: string;
  token: string; // 소문자 hex
  environment: 'sandbox' | 'production';
}

interface PitRunLiveActivityNative {
  // mode: "race" | "qualifying" | "warmup" — Lock screen / expanded color 분기.
  startActivity(driverName: string, teamColor: string, circuitId: string, mode: string): Promise<string | null>;
  // APNs push 토큰 직접 조회 (폴백). 이벤트를 놓쳤거나 JS context 재시작 시 사용.
  getPushToken(activityId: string): Promise<string | null>;
  // NSSupportsLiveActivitiesFrequentUpdates 사용자 허용 여부.
  frequentPushesEnabled(): boolean;
  // MMKV에 저장된 id가 실제 살아있는 Activity인지 검증 (stale id 재사용 방지).
  isActivityActive(activityId: string): boolean;
  // expo-modules-core EventEmitter — onLiveActivityPushToken 구독.
  addListener(eventName: string, listener: (event: LiveActivityPushTokenEvent) => void): EventSubscription;
  // updateActivity는 state를 dict로 받음 (expo-modules-core의 AsyncFunction
  // 매개변수 개수 상한 초과로 인한 native binding 깨짐 회피).
  updateActivity(activityId: string, state: {
    distKm: number;
    elapsedMs: number;
    paceS: number;
    sector: string;
    tire: string;
    pitPhase: string;
    prog: number;
    isPaused: boolean;
    mode: string;
    timerStartMs: number | null;
    timerEndMs: number | null;
  }): Promise<boolean>;
  endActivity(activityId: string): Promise<void>;
  endAllActivities(): Promise<void>;
  isSupported(): boolean;
}

// IMPORTANT: 'PitRunLiveActivity'는 widget extension target name과 동일해서
// EAS prebuild 시 autolinking이 silent fail. Swift Name()도 *Bridge로 등록.
const MODULE_NAME = 'PitRunLiveActivityBridge';

// Lazy lookup on EVERY call — defends against New Arch / TurboModule race where
// the native module isn't registered yet at JS bundle load time. The previous
// implementation captured the lookup once at module load → if that initial
// lookup returned null, the app was permanently stuck on the noop fallback.
function getNativeModule(): PitRunLiveActivityNative | null {
  if (Platform.OS !== 'ios') return null;
  const mod = requireOptionalNativeModule<PitRunLiveActivityNative>(MODULE_NAME);
  if (!mod) {
    console.error(
      `[PitRunLA-DIAG] requireOptionalNativeModule('${MODULE_NAME}') returned null. ` +
      `Module is NOT registered at this call time.`
    );
  }
  return mod;
}

export function isSupported(): boolean {
  const mod = getNativeModule();
  if (!mod) {
    console.error('[PitRunLA-DIAG] isSupported: module missing, returning false');
    return false;
  }
  const result = mod.isSupported();
  console.warn(`[PitRunLA-DIAG] isSupported() → ${result}`);
  return result;
}

export async function startActivity(
  driverName: string,
  teamColor: string,
  circuitId: string,
  mode: string
): Promise<string | null> {
  const mod = getNativeModule();
  if (!mod) {
    console.error('[PitRunLA-DIAG] startActivity: module missing, returning null');
    return null;
  }
  console.warn('[PitRunLA-DIAG] startActivity: calling native', { driverName, teamColor, circuitId, mode });
  try {
    const id = await mod.startActivity(driverName, teamColor, circuitId, mode);
    console.warn(`[PitRunLA-DIAG] startActivity: native returned id=${id}`);
    return id;
  } catch (e) {
    console.error('[PitRunLA-DIAG] startActivity: native THREW', String(e));
    throw e;
  }
}

export async function updateActivity(
  activityId: string,
  state: {
    distKm: number;
    elapsedMs: number;
    paceS: number;
    sector: string;
    tire: string;
    pitPhase: string;
    prog: number;
    isPaused: boolean;
    mode: string;
    timerStartMs: number | null;
    timerEndMs: number | null;
  }
): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;
  try {
    return await mod.updateActivity(activityId, state);
  } catch (e) {
    console.error('[PitRunLA-DIAG] updateActivity threw', String(e));
    return false;
  }
}

export async function endActivity(activityId: string): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    await mod.endActivity(activityId);
  } catch (e) {
    console.error('[PitRunLA-DIAG] endActivity threw', String(e));
  }
}

export async function endAllActivities(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    await mod.endAllActivities();
  } catch (e) {
    console.error('[PitRunLA-DIAG] endAllActivities threw', String(e));
  }
}

/**
 * APNs Live Activity push 토큰 갱신 구독.
 * 토큰은 비동기로 도착하고 rotation도 가능하므로 반드시 이벤트로 받는다.
 * 반환된 subscription.remove()로 해제.
 */
export function addPushTokenListener(
  listener: (event: LiveActivityPushTokenEvent) => void,
): EventSubscription | null {
  const mod = getNativeModule();
  if (!mod) return null;
  try {
    return mod.addListener('onLiveActivityPushToken', listener);
  } catch (e) {
    console.error('[PitRunLA-DIAG] addPushTokenListener threw', String(e));
    return null;
  }
}

/** 현재 activity의 APNs push 토큰을 직접 조회 (이벤트 폴백). */
export async function getPushToken(activityId: string): Promise<string | null> {
  const mod = getNativeModule();
  if (!mod) return null;
  try {
    return await mod.getPushToken(activityId);
  } catch (e) {
    console.error('[PitRunLA-DIAG] getPushToken threw', String(e));
    return null;
  }
}

/** NSSupportsLiveActivitiesFrequentUpdates 사용자 허용 여부 (priority 10 throttle 힌트). */
export function frequentPushesEnabled(): boolean {
  const mod = getNativeModule();
  if (!mod) return false;
  try {
    return mod.frequentPushesEnabled();
  } catch {
    return false;
  }
}

/** MMKV에 저장된 activityId가 실제 살아있는 Activity인지 확인 (stale id 재사용 방지). */
export function isActivityActive(activityId: string): boolean {
  const mod = getNativeModule();
  if (!mod) return false;
  try {
    return mod.isActivityActive(activityId);
  } catch {
    return false;
  }
}
