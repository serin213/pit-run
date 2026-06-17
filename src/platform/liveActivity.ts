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

import { AppState } from 'react-native';
import { laDiag } from './gpsDiag';
import {
  startActivity as nativeStart,
  updateActivity as nativeUpdate,
  endActivity as nativeEnd,
  endAllActivities as nativeEndAll,
  isSupported as nativeIsSupported,
  addPushTokenListener,
  getPushToken as nativeGetPushToken,
  frequentPushesEnabled as nativeFrequentPushesEnabled,
  type LiveActivityPushTokenEvent,
} from 'pit-run-live-activity';
import { getString, setString, remove } from './storage';
import { registerLiveActivityToken, endLiveActivityToken, sendLiveActivityPush } from '../api/liveActivityPush';
import {
  buildLiveActivityContentState,
  liveActivityPushPriority,
  isLiveActivityVisualTransition,
} from '../core/liveActivityPayload';

export type LiveActivityMode = 'race' | 'qualifying' | 'warmup';

export interface LiveActivityState {
  distKm: number;
  elapsedMs: number;
  paceS: number;
  // 묶음 1b-LA 보완: sector 시스템 폐기 후 LA payload 호환성 prop. Swift 측 색상
  // 결정엔 무관 (teamColor가 결정). dummy 값(예: 'red' 폴백 통일)만 들어옴.
  sector: string;
  tire: 'soft' | 'medium' | 'hard' | 'wet';
  pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';
  prog: number;
  isPaused: boolean;
  // race: prog는 race 진행도, distKm/sector/pitPhase는 정상 race state.
  // qualifying: prog는 1km 진행도 (0~1), elapsedMs는 경과 시간, distKm 미사용.
  // warmup: elapsedMs는 "남은 ms" (카운트다운), prog 미사용.
  // attributes schema는 동일 — elapsedMs 의미만 mode별로 재해석.
  mode: LiveActivityMode;
  // FIX 10-B: timerInterval 전환 — iOS 자체 틱 (push 0회).
  // timerStartMs: epoch ms 경과 기준점 (qualifying/race).
  // timerEndMs:   epoch ms 카운트다운 목표 (warmup).
  timerStartMs?: number;
  timerEndMs?: number;
}

const CURRENT_ACTIVITY_ID_KEY = 'live_activity_current_id_v1';
const CURRENT_PUSH_TOKEN_KEY = 'live_activity_push_token_v1';
const CURRENT_PUSH_ENV_KEY = 'live_activity_push_env_v1';
const CURRENT_RACE_ID_KEY = 'live_activity_race_id_v1';

let currentActivityId: string | null = null;

// APNs push 상태 — 토큰은 비동기로 도착하므로 모듈 레벨에 캐시하고 MMKV에도 영속화한다.
// (JS context 재시작/백그라운드 콜백에서도 동일 토큰을 읽어 서버 등록할 수 있게.)
let currentPushToken: string | null = null;
let currentPushEnv: 'sandbox' | 'production' = 'production';
let currentRaceId: string | null = null;

const LA_TAG = '[LiveActivity]';

export function isLiveActivitySupported(): boolean {
  const supported = nativeIsSupported();
  if (__DEV__) console.log(`${LA_TAG} isSupported() →`, supported);
  return supported;
}

export function getCurrentActivityId(): string | null {
  if (currentActivityId) return currentActivityId;
  currentActivityId = getString(CURRENT_ACTIVITY_ID_KEY) ?? null;
  return currentActivityId;
}

// ── APNs push token ───────────────────────────────────────────────────────────

/** 현재 활성 Live Activity의 APNs push token (hex). 아직 미발급이면 null. */
export function getCurrentLiveActivityPushToken(): string | null {
  if (currentPushToken) return currentPushToken;
  currentPushToken = getString(CURRENT_PUSH_TOKEN_KEY) ?? null;
  return currentPushToken;
}

/**
 * 레이스 식별자를 Live Activity push 등록에 연결한다.
 * useRunning/CountdownScreen이 race 시작 시 runStore.raceId로 호출.
 * 토큰이 이미 도착했으면 즉시 서버 등록을 재시도한다.
 */
export function setLiveActivityRaceId(raceId: string | null): void {
  currentRaceId = raceId;
  if (raceId) setString(CURRENT_RACE_ID_KEY, raceId);
  else remove(CURRENT_RACE_ID_KEY);
  void maybeRegisterPushToken();
}

let pushTokenSubscribed = false;

/**
 * 네이티브 onLiveActivityPushToken 이벤트 구독 — 모듈 로드 시 1회.
 * 토큰은 비동기로 도착하고 rotation도 가능하므로 반드시 이벤트로 받아 갱신한다.
 * 로컬 Activity.update 폴백과 독립 — 토큰 수신 실패가 로컬 갱신/사운드를 막지 않는다.
 */
export function initLiveActivityPushTokens(): void {
  if (pushTokenSubscribed) return;
  const sub = addPushTokenListener((event: LiveActivityPushTokenEvent) => {
    if (__DEV__) console.log(`${LA_TAG} pushToken received`, event.activityId, event.environment);
    currentPushToken = event.token;
    currentPushEnv = event.environment;
    setString(CURRENT_PUSH_TOKEN_KEY, event.token);
    setString(CURRENT_PUSH_ENV_KEY, event.environment);
    // 이벤트의 activityId를 신뢰원으로 — currentActivityId와 일치시킨다.
    if (event.activityId) {
      currentActivityId = event.activityId;
      setString(CURRENT_ACTIVITY_ID_KEY, event.activityId);
    }
    void maybeRegisterPushToken();
  });
  if (sub) pushTokenSubscribed = true;
}

/**
 * 토큰 + activityId가 준비되면 서버에 등록(upsert).
 * 미로그인이면 api 레이어에서 조용히 skip하고, 로그인/다음 토큰 이벤트 때 재시도된다.
 * race_id는 nullable이라 raceId 미설정이어도 등록은 진행한다.
 */
async function maybeRegisterPushToken(): Promise<void> {
  const token = getCurrentLiveActivityPushToken();
  const activityId = getCurrentActivityId();
  if (!token || !activityId) return;
  try {
    await registerLiveActivityToken({
      activityId,
      pushToken: token,
      environment: currentPushEnv,
      frequentPushesEnabled: nativeFrequentPushesEnabled(),
      raceId: currentRaceId ?? getString(CURRENT_RACE_ID_KEY) ?? null,
    });
    if (__DEV__) console.log(`${LA_TAG} pushToken registered with server`, activityId);
  } catch (e) {
    if (__DEV__) console.warn(`${LA_TAG} pushToken register failed`, e);
  }
}

/** 폴백: 이벤트를 놓친 경우 네이티브에서 현재 토큰을 직접 조회해 등록 시도. */
export async function refreshLiveActivityPushToken(): Promise<void> {
  const activityId = getCurrentActivityId();
  if (!activityId) return;
  const token = await nativeGetPushToken(activityId);
  if (!token) return;
  currentPushToken = token;
  setString(CURRENT_PUSH_TOKEN_KEY, token);
  await maybeRegisterPushToken();
}

function clearPushTokenState(): void {
  currentPushToken = null;
  remove(CURRENT_PUSH_TOKEN_KEY);
  remove(CURRENT_PUSH_ENV_KEY);
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
  // 토큰 이벤트 구독 보장 — start 시점에 무조건 1회 init (idempotent).
  initLiveActivityPushTokens();
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
    if (id) setString(CURRENT_ACTIVITY_ID_KEY, id);
    else remove(CURRENT_ACTIVITY_ID_KEY);
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
  laDiag.pushTried++;
  laDiag.lastPushAt = Date.now();
  laDiag.lastPushDistKm = state.distKm;
  laDiag.lastPushWasBg = AppState.currentState !== 'active';
  try {
    const updated = await nativeUpdate(activityId, {
      distKm: state.distKm,
      elapsedMs: state.elapsedMs,
      paceS: state.paceS,
      sector: state.sector,
      tire: state.tire,
      pitPhase: state.pitPhase,
      prog: state.prog,
      isPaused: state.isPaused,
      mode: state.mode,
      timerStartMs: state.timerStartMs ?? null,
      timerEndMs: state.timerEndMs ?? null,
    });
    if (!updated) {
      laDiag.nativeMiss++;
      throw new Error('native update returned false');
    }
    laDiag.pushOk++;
  } catch (e) {
    laDiag.pushFail++;
    laDiag.lastErrorMsg = String(e).slice(0, 200);
    if (__DEV__) console.warn(`${LA_TAG} update threw`, e);
  }
}

/**
 * 서버 APNs push로 Live Activity 렌더를 갱신한다 (로컬 update와 별개·보강).
 *
 * - 로컬 updateLiveActivity가 1차 source. 이 함수는 잠금/throttle 상황에서 렌더
 *   신뢰성을 높이는 best-effort 보강이며, 실패해도 무시한다.
 * - 로컬 GPS/사운드 트리거 결정과 무관 — 호출부는 이미 사운드를 발화한 뒤 호출한다.
 * - priority는 시각 전환(boxbox/fullPush/completed)이면 10, 그 외 일반 거리 갱신은 5.
 */
export async function pushLiveActivityUpdate(
  activityId: string,
  state: LiveActivityState,
): Promise<void> {
  // 토큰이 아직 없으면 서버에 등록된 row도 없으니 push 의미 없음 → skip.
  if (!getCurrentLiveActivityPushToken()) return;
  const isTransition = isLiveActivityVisualTransition(state.pitPhase);
  try {
    await sendLiveActivityPush({
      activityId,
      contentState: buildLiveActivityContentState(state),
      priority: liveActivityPushPriority(isTransition),
      // stale-date 60초 — 로컬 updateActivity와 동일 정책 (locationTask 참고).
      staleDateMs: Date.now() + 60_000,
    });
  } catch {
    // best-effort — 무시.
  }
}

export async function endLiveActivity(activityId: string): Promise<void> {
  try {
    await nativeEnd(activityId);
    if (__DEV__) console.log(`${LA_TAG} end: ok`, activityId);
  } catch (e) {
    console.warn(`${LA_TAG} end threw`, e);
  } finally {
    // 서버 push 대상에서 제외 — status='ended'. 로컬 종료와 독립적으로 best-effort.
    void endLiveActivityToken(activityId).catch(() => {});
    if (currentActivityId === activityId) {
      currentActivityId = null;
    }
    const stored = getString(CURRENT_ACTIVITY_ID_KEY);
    if (stored === activityId) remove(CURRENT_ACTIVITY_ID_KEY);
    clearPushTokenState();
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
    const prevId = currentActivityId ?? getString(CURRENT_ACTIVITY_ID_KEY) ?? null;
    if (prevId) void endLiveActivityToken(prevId).catch(() => {});
    currentActivityId = null;
    remove(CURRENT_ACTIVITY_ID_KEY);
    clearPushTokenState();
  }
}
