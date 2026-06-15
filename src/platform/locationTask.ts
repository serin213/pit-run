/**
 * Background location task
 *
 * JS context is isolated from the foreground — direct Zustand access is impossible.
 *
 * Architecture (v4 — industry-standard with Doppler-or-haversine fallback):
 *
 *   Layer 1 — Validity gate (don't touch PREV_KEY):
 *     - Stale: timestamp > MAX_STALE_MS old → skip entirely
 *     - Invalid fix: accuracy < 0 → skip entirely
 *
 *   Layer 2 — PREV_KEY update (gated by accuracy):
 *     Update PREV_KEY only when accuracy <= PREV_ACCURACY_M (50 m).
 *     v3 updated PREV unconditionally → next haversine baseline could be a 200m-noisy
 *     fix, polluting future readings. v4: bad fix doesn't become future reference,
 *     but doesn't lose data either (Layer 4 dt-aware teleport still allows long gaps).
 *
 *   Layer 3 — Distance quality gate:
 *     - accuracy > MAX_ACCURACY_M (100 m) → too noisy, skip distance
 *
 *   Layer 4 — Teleport filter (dt-aware):
 *     - haversine > MAX_RUNNING_MS × dtSec → GPS jump, skip distance
 *     - Scales with time: 1 s gap allows 10 m, 5 s gap allows 50 m (still realistic)
 *
 *   Layer 5 — Distance accumulation (Doppler-or-haversine, NEVER skip valid motion):
 *     a) Doppler speed reliable (speed >= MIN_SPEED_MS): use speed × dtSec
 *     b) Doppler weak/zero BUT haversine implies motion (impliedSpeed >= MIN_SPEED_MS,
 *        i.e. dist/dtSec exceeds 0.3 m/s): use haversine
 *        — This is the v4 critical fix: iOS commonly reports speed = 0 even while moving
 *          (between GPS samples, after speed-change, signal degradation). v3 dropped
 *          this segment entirely → 거리 과소측정. v4 falls back to position delta.
 *     c) Both Doppler weak AND impliedSpeed below threshold → truly stationary, skip
 *
 * Why Doppler-OR-haversine?
 *   - iOS CLLocation.speed is Doppler-derived (carrier shift) — accurate when valid
 *   - But iOS often returns speed = 0 mid-run (just after a sample, weak signal, etc.)
 *   - Pure Doppler-first (v3) loses these segments → systematic under-measurement
 *   - Standard running apps (Strava, Nike+, Runkeeper) cross-validate: trust whichever
 *     of Doppler / haversine indicates higher-confidence motion at that instant
 *
 * References:
 *   - Freeletics Engineering (2019): iOS GPS Testing with Kalman filter
 *   - Nike+, Strava engineering: accuracy threshold 50–100 m, speed-gate ~10 m/s
 *   - mad-location-manager (maddevsio): GeoHash + Kalman (open source reference)
 */

import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { COLORS } from '../constants/colors';
import { getString, setString, remove } from './storage';
import { gpsDiag, pushCbLog } from './gpsDiag';
import { haversineKm, type LocationCoords } from './location';
import { playSound } from './audio';
import {
  getActiveRacePlan,
  updateActiveRacePlan,
  clearActiveRacePlan,
  type ActiveRacePlan,
} from '../api/racePlan';
import { appendRaceLapEntry, getRaceLapLog } from '../api/raceLapLog';
import { updateLiveActivity, getCurrentActivityId } from './liveActivity';
import { useAppStore } from '../store/appStore';
import { CIRCUITS } from '../config/circuits';
import { debugGpsConfig } from './debugGpsConfig';

/**
 * Background race event check — distance 누적 직후 호출.
 *
 * 1. nextFullPushAtMs 시점 도래 → playSound('fullPush'), plan 업데이트
 * 2. work 페이즈 (nextFullPushAtMs === null)이고 intervalKm 도달 → playSound('boxbox'),
 *    nextFullPushAtMs 예약 (Date.now() + BOXBOX_ALERT_MS + recoveryDurationMs)
 *
 * 모든 동작은 try-catch로 보호 — 사운드 실패해도 distance 누적은 계속.
 *
 * 사용 가능한 이유:
 *   - app.json UIBackgroundModes: ["location", "audio"]
 *   - expo-audio setAudioModeAsync({shouldPlayInBackground: true})
 *   - 따라서 background location callback이 깨어날 때 audio session도 활성 → playSound 정상 동작
 */
const BOXBOX_ALERT_MS = 4000; // useRunning의 BOXBOX_ALERT_MS와 동일

// background callback async race condition 방지.
// iOS Core Location이 잠금 중 GPS fix burst를 보낼 때 같은 stale plan으로
// 중복 trigger 발화 가능 (Apple Forum thread 729387 확인).
// await playSound 진행 중 다른 callback이 들어와도 flag로 차단.
let boxboxTriggerInFlight = false;
let fullPushTriggerInFlight = false;

// LA push 5초 throttle. iOS ActivityKit은 너무 자주 update하면 budget 소진 후
// 영구 throttle/drop 가능 (Apple Developer Forum thread 731715, 776031 확인).
// NSSupportsLiveActivitiesFrequentUpdates: true 설정되어 있지만 안전 마진 추가.
// phase transition (boxbox/fullPush)은 즉시 push하고 이 throttle 무시.
let lastLAPushTime = 0;
const LA_PUSH_MIN_INTERVAL_MS = 5000;

// foreground useRunning.ts의 derivePitPhaseFromPlan과 동일 로직.
// background callback이 매번 plan에서 phase derive하기 위함.
// boxbox/fullPush trigger와 별개로 일반 거리 갱신용 LA push에 사용.
function derivePitPhaseFromPlan(plan: ActiveRacePlan, now: number): 'none' | 'inPit' {
  if (plan.nextFullPushAtMs != null && plan.nextFullPushAtMs > now) return 'inPit';
  return 'none';
}

async function maybeFireBackgroundRaceEvents(): Promise<void> {
  gpsDiag.bgEventCallCount++;
  let plan = getActiveRacePlan();
  if (!plan) { gpsDiag.bgEventPlanNull++; return; }
  // 이중 안전망 — clear가 호출되지 않은 채 race가 종료된 stale plan 방어.
  // 정상 흐름에선 clearActiveRacePlan으로 plan 자체가 제거되어 위 null 체크에서
  // 잡히지만, 앱 swipe kill 직후 task가 살아남는 케이스에서는 plan만 남고 race는
  // 끝난 상태가 가능. cleanupStaleBackgroundTask가 부팅 시 isRunning을 false로
  // 패치하거나 plan을 지워주지만, 그 사이 발화하는 한 사이클을 막기 위한 가드.
  if (!plan.isRunning) { gpsDiag.bgEventPlanNull++; return; }
  // 외출② 보완: pause 중에는 trigger 발화 + lap log push + LA update 모두 skip.
  // distance 누적 자체는 background callback의 Layer 5에서 계속됨 — resume 후 그대로
  // 사용. pause 의도는 "trigger 발화 중단" + "사용자가 직접 끝낸 race에서 박스박스/
  // 풀푸시 추가 발화 차단".
  if (plan.isPaused) { gpsDiag.bgEventPlanNull++; return; }

  const now = Date.now();

  // ── QUALIFYING mode ────────────────────────────────────────────────────────
  // 1km 도달 시 qualifyingEnd 사운드 1회 발화. boxbox/fullPush 로직 무관.
  // 잠금/백그라운드 상태에서도 사운드 발화 — race와 동일 패턴.
  if (plan.mode === 'qualifying') {
    gpsDiag.bgEventQualifying++;
    const currentAccum = readAccum();
    if (plan.completedReps === 0 && currentAccum >= plan.intervalKm) {
      try { await playSound('qualifyingEnd'); } catch {}
      plan = updateActiveRacePlan({ completedReps: 1 }) ?? plan;
      await fireQualifyingLAUpdate(plan, currentAccum, now, true).catch(() => {});
      lastLAPushTime = now;
      return; // qualifying은 boxbox/fullPush 분기 안 탐
    }
    // 미완주: 5초 throttle로 LA prog 갱신
    if (now - lastLAPushTime >= LA_PUSH_MIN_INTERVAL_MS) {
      await fireQualifyingLAUpdate(plan, currentAccum, now, false).catch(() => {});
      lastLAPushTime = now;
    }
    return; // qualifying은 boxbox/fullPush 분기 안 탐
  }

  // ── RACE mode ──────────────────────────────────────────────────────────────
  // 묶음 2: trigger 발화 + plan 업데이트 + lap entry push + LA update 모두 여기서.
  // foreground useRunning checkBoxBox는 폐기 (UI는 polling으로 sync).

  // (1) 예약된 fullPush 시점 도래 → 회복 종료 → 다음 work 시작
  // 외출① 보완: atomic guard (fullPushTriggerInFlight) + plan-first 순서로 async race 차단.
  if (plan.nextFullPushAtMs && now >= plan.nextFullPushAtMs && !fullPushTriggerInFlight) {
    fullPushTriggerInFlight = true;
    try {
      const accumAtFullPush = readAccum();

      // (1) plan 동기 update 먼저 — 다른 callback이 새 plan 보고 자연스럽게 조건 미달
      plan = updateActiveRacePlan({
        nextFullPushAtMs: null,
        lastBoxBoxAtKm: accumAtFullPush,
        lastFiredAt: 'fullPush',
        lastFiredAtMs: now,
        workStartedAtMs: now,
        workStartedAtKm: accumAtFullPush,
        pitStartedAtMs: null,
        pitStartedAtKm: null,
      }) ?? plan;

      // (2) await playSound (이제 race-safe)
      try { await playSound('fullPush'); } catch {}
      gpsDiag.bgEventFullPushFired++;

      // (3) 회복 segment lap entry push (type='pit')
      if (plan.pitStartedAtMs != null && plan.pitStartedAtKm != null) {
        const pitDistM = Math.max(0, Math.round((accumAtFullPush - plan.pitStartedAtKm) * 1000));
        const pitDurationSec = Math.max(0.1, (now - plan.pitStartedAtMs) / 1000);
        const idx = getRaceLapLog().length;
        appendRaceLapEntry({
          idx,
          type: 'pit',
          distM: pitDistM,
          durationSec: pitDurationSec,
          paceS: null,
        });
      }

      // (4) LA update — pitPhase='none' (잠금 중 work 단계로 즉시 전환).
      await fireLAUpdate(plan, accumAtFullPush, now, 'none').catch((e) => {
        console.warn('[locationTask] LA update (fullPush) failed:', e);
      });
      lastLAPushTime = now;
    } finally {
      fullPushTriggerInFlight = false;
    }
  }

  // (2) work 페이즈 + interval 도달 검사 (currentAccum vs lastBoxBoxAtKm)
  // 외출① 보완: atomic guard + plan-first 순서.
  if (plan.nextFullPushAtMs == null && plan.completedReps < plan.maxReps) {
    const currentAccum = readAccum();
    const workKm = currentAccum - plan.lastBoxBoxAtKm;
    if (workKm >= plan.intervalKm && !boxboxTriggerInFlight) {
      boxboxTriggerInFlight = true;
      try {
        // (1) plan 동기 update 먼저
        plan = updateActiveRacePlan({
          lastBoxBoxAtKm: currentAccum,
          completedReps: plan.completedReps + 1,
          nextFullPushAtMs: now + BOXBOX_ALERT_MS + plan.recoveryDurationMs,
          lastFiredAt: 'boxbox',
          lastFiredAtMs: now,
          pitStartedAtMs: now,
          pitStartedAtKm: currentAccum,
        }) ?? plan;

        // (2) await playSound
        try { await playSound('boxbox'); } catch {}
        gpsDiag.bgEventBoxBoxFired++;

        // (3) work segment lap entry push (type='lap')
        const distM = Math.max(0, Math.round((currentAccum - plan.workStartedAtKm) * 1000));
        const durationSec = Math.max(0.1, (now - plan.workStartedAtMs) / 1000);
        const paceS = distM > 0 ? durationSec / (distM / 1000) : null;
        const idx = getRaceLapLog().length;
        appendRaceLapEntry({
          idx,
          type: 'lap',
          distM,
          durationSec,
          paceS: paceS != null && isFinite(paceS) ? Math.round(paceS) : null,
        });

        // (4) LA update — pitPhase='inPit' (잠금 중 회복 단계로 즉시 전환).
        await fireLAUpdate(plan, currentAccum, now, 'inPit').catch((e) => {
          console.warn('[locationTask] LA update (boxbox) failed:', e);
        });
        lastLAPushTime = now;
      } finally {
        boxboxTriggerInFlight = false;
      }
    } else if (workKm < plan.intervalKm) {
      gpsDiag.bgEventWorkNotReady++;
    }
  } else if (plan.nextFullPushAtMs != null) {
    gpsDiag.bgEventNotWorkPhase++;
  }

  // 외출① 보완: 매 callback마다 일반 거리 갱신용 LA push (5초 throttle).
  // 잠금 중 LA distance/elapsedMs/prog 멈춤 + 잠금 풀 때 점프 문제 해결.
  // boxbox/fullPush 발화 시점엔 위에서 이미 fireLAUpdate + lastLAPushTime 업데이트했으니
  // 이 조건 자연스럽게 skip.
  const elapsedSinceLastPush = now - lastLAPushTime;
  if (elapsedSinceLastPush >= LA_PUSH_MIN_INTERVAL_MS) {
    const currentAccum = readAccum();
    const phase = derivePitPhaseFromPlan(plan, now);
    await fireLAUpdate(plan, currentAccum, now, phase).catch((e) => {
      console.warn('[locationTask] LA update (regular) failed:', e);
    });
    lastLAPushTime = now;
  }
}

/**
 * Qualifying 모드 전용 LA update.
 * fireLAUpdate 재사용 금지 — payload 의미가 다름 (prog = dist/1km, mode='qualifying').
 *
 * 주의: timerStartMs는 매 push마다 반드시 plan.startedAtMs를 재전송해야 한다.
 * null로 보내면 Swift timerText가 formatQualTime 폴백 분기로 떨어져 timerInterval
 * 자체 틱이 끊기고 잠금화면 타이머가 멈춰 보임.
 */
async function fireQualifyingLAUpdate(
  plan: ActiveRacePlan,
  distKm: number,
  now: number,
  completed: boolean,
): Promise<void> {
  const id = getCurrentActivityId();
  if (!id) return;
  const prog = Math.max(0, Math.min(1, distKm / plan.intervalKm));
  const elapsedMs = Math.max(0, now - plan.startedAtMs);
  const isBg = AppState.currentState !== 'active';
  if (isBg) gpsDiag.bgLaTried++;
  await updateLiveActivity(id, {
    distKm: 0,
    elapsedMs,
    paceS: 0,
    sector: 'red',
    tire: 'soft',
    pitPhase: completed ? 'completed' : 'none',
    prog,
    isPaused: plan.isPaused,
    mode: 'qualifying',
    timerStartMs: plan.startedAtMs,
  });
  if (isBg) gpsDiag.bgLaOk++;
}

/**
 * 묶음 2: background에서 LA update 호출.
 * Apple ActivityKit은 background에서도 update 허용. expo-modules-core AsyncFunction
 * 호출 자체는 RN JS context에서 자유롭게 가능 — locationTask callback도 동일 context.
 * paceS/elapsedMs는 plan + readAccum 기반으로 계산. selectedCircuitId + CIRCUITS로
 * prog 계산.
 */
async function fireLAUpdate(
  plan: ActiveRacePlan,
  distKm: number,
  now: number,
  pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed',
): Promise<void> {
  const id = getCurrentActivityId();
  if (!id) return;
  const elapsedMs = Math.max(0, now - plan.startedAtMs);
  const paceS = distKm > 0 ? Math.round(elapsedMs / 1000 / distKm) : 0;
  const selectedCircuitId = useAppStore.getState().selectedCircuitId;
  const circuitKm = CIRCUITS.find((c) => c.id === selectedCircuitId)?.distanceKm ?? 0;
  const prog = circuitKm > 0 ? Math.min(distKm / circuitKm, 1) : 0;
  // tire 정보는 background에 없으므로 store 또는 'medium' 폴백.
  const tire = (useAppStore.getState() as { tire?: 'soft' | 'medium' | 'hard' | 'wet' }).tire ?? 'medium';
  const isBg = AppState.currentState !== 'active';
  if (isBg) gpsDiag.bgLaTried++;
  await updateLiveActivity(id, {
    distKm,
    elapsedMs,
    paceS,
    sector: 'red',
    tire,
    pitPhase,
    prog,
    isPaused: plan.isPaused,
    mode: 'race',
  });
  if (isBg) gpsDiag.bgLaOk++;
}

export const BACKGROUND_LOCATION_TASK = 'pit-run-background-location';

// Storage keys
const LATEST_KEY  = 'bg_location_latest';   // v1 compat (diagnostics only)
const PREV_KEY    = 'bg_location_prev';      // last processed coords + timestamp
const ACCUM_KEY   = 'bg_location_accum_km'; // accumulated valid distance (km)

// ── Filter constants ─────────────────────────────────────────────────────────
/** 100 m 초과 accuracy 읽기는 distance 누적 안 함 (Nike+/Strava 표준 50~100m 범위). */
const MAX_ACCURACY_M   = 100;
/** 50 m 이내 accuracy일 때만 PREV_KEY 업데이트 → 다음 haversine 기준점이 노이즈에
 *  오염되지 않게. v3은 무조건 PREV 업데이트해서 노이즈 fix가 baseline이 되는 버그.  */
const PREV_ACCURACY_M  = 50;
/** 10 초 이상 된 stale 읽기는 완전 스킵 (iOS cached location 방어). */
const MAX_STALE_MS     = 10_000;
/** 10 m/s = 36 km/h — 달리기 최대 속도. dt와 곱해 teleport 판정. */
const MAX_RUNNING_MS   = 10;
/** 0.3 m/s 미만 = 정지 상태. Doppler/haversine 둘 다 이 임계값 아래면 누적 안 함. */
const MIN_SPEED_MS     = 0.3;
/** Haversine 0.5 m 미만 미세 변동 = GPS 드리프트로 처리. */
const MIN_DELTA_KM     = 0.0005;

type StoredCoords = LocationCoords & { timestamp: number };

function readPrev(): StoredCoords | null {
  const raw = getString(PREV_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredCoords; }
  catch { return null; }
}

function readAccum(): number {
  const raw = getString(ACCUM_KEY);
  if (!raw) return 0;
  try { return parseFloat(raw) || 0; }
  catch { return 0; }
}

export function defineBackgroundLocationTask(): void {
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
      if (error) {
        gpsDiag.startError = 'task-cb error: ' + String(error);
        return;
      }
      const { locations } = data as { locations: Location.LocationObject[] };
      if (!locations?.length) {
        gpsDiag.startError = 'task-cb empty locations';
        return;
      }

      // FIX 15-1B: pause 중에는 거리 누적 skip (PREV_KEY는 Layer 2에서 계속 갱신) —
      // resume 시 pause 동안 이동한 직선거리가 한 번에 들어오는 점프 방지.
      const racePlan = getActiveRacePlan();
      const isPausedForAccum = racePlan?.mode === 'race' && racePlan.isPaused;

      // FIX 12: locations 배열 전체 순회 — iOS가 여러 샘플을 묶어서 줄 때 중간 점 손실 방지.
      // distanceFilter 제거 후 콜백이 더 잦아져도 배열 길이는 1이 대부분이지만,
      // 잠금 해제 직후 batch 도착 케이스에서 점프 완화 효과.
      // 트리거 평가(maybeFireBackgroundRaceEvents)는 루프 후 1회만 — 중복 발화 방지.
      gpsDiag.taskWriteCount++;
      gpsDiag.lastTaskWriteTs = locations[locations.length - 1].timestamp;
      pushCbLog('cb');
      // 잠금 중 콜백 검증 카운터 (FIX 12)
      if (AppState.currentState !== 'active') gpsDiag.bgTw++;

      for (const loc of locations) {
        // ── Layer 1: Validity gate ────────────────────────────────────────────
        // Stale: iOS delivers a cached last-known-location on first callback which
        // can be minutes old. Reject anything > 10 s old.
        const ageMs = Date.now() - loc.timestamp;
        if (ageMs > MAX_STALE_MS) {
          gpsDiag.distSkipCount++;
          continue;
        }
        // Invalid fix: negative accuracy means no satellite fix at all.
        if ((loc.coords.accuracy ?? -1) < 0) {
          gpsDiag.distSkipCount++;
          continue;
        }

        const coords: StoredCoords = {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude:  loc.coords.altitude,
          accuracy:  loc.coords.accuracy,
          speed:     loc.coords.speed,
          timestamp: loc.timestamp,
        };

        // Keep LATEST_KEY for diagnostics (v1 compat) — 마지막 유효 좌표로 덮어씀
        setString(LATEST_KEY, JSON.stringify(coords));

        // ── Layer 2: PREV_KEY update (accuracy-gated) ────────────────────────
        // 노이즈 fix가 baseline이 되어 다음 haversine을 망치는 v3 버그 fix.
        // accuracy <= 50m 일 때만 PREV 업데이트. 그보다 나쁜 fix는 처리는 하되 PREV에
        // 저장 안 함 → 다음 read는 여전히 마지막 양호한 위치를 baseline으로 사용.
        const prev = readPrev();
        if ((coords.accuracy ?? Infinity) <= PREV_ACCURACY_M) {
          setString(PREV_KEY, JSON.stringify(coords));
        }

        if (!prev) continue; // first valid reading, no delta yet

        const dist  = haversineKm(prev, coords);
        const dtSec = (coords.timestamp - prev.timestamp) / 1000;

        gpsDiag.lastDist = dist;

        if (dtSec <= 0) continue;

        // ── Layer 3: Distance quality gate ───────────────────────────────────
        if ((coords.accuracy ?? 0) > MAX_ACCURACY_M) {
          gpsDiag.distSkipCount++;
          continue;
        }

        // ── Layer 4: Teleport filter (dt-aware) ──────────────────────────────
        // 1 s gap → 10 m 허용, 5 s gap → 50 m 허용. 고정 임계값보다 long gap 후 정상
        // 이동을 통째로 버리는 케이스 감소.
        const impliedSpeedMs = (dist * 1000) / dtSec;
        if (impliedSpeedMs > MAX_RUNNING_MS) {
          gpsDiag.distSkipCount++;
          continue;
        }

        // ── Layer 5: Distance accumulation (Doppler-OR-haversine) ────────────
        // v3은 Doppler가 valid면 무조건 Doppler만 사용 → iOS가 speed=0을 자주 보내는
        // 현실에서 그 segment 통째 누락. v4: Doppler가 신뢰할 만하면 Doppler, 그렇지
        // 않지만 위치가 실제로 이동했으면 haversine. 둘 다 멈춤 신호일 때만 skip.
        const dopplerSpeed = coords.speed ?? -1; // m/s; -1 = invalid on iOS
        let deltaKm: number;

        if (dopplerSpeed >= MIN_SPEED_MS) {
          // (a) Doppler 신뢰할 만함 — 위성 carrier-shift 기반이라 positional noise에 독립적
          deltaKm = (dopplerSpeed * dtSec) / 1000;
        } else if (impliedSpeedMs >= MIN_SPEED_MS && dist >= MIN_DELTA_KM) {
          // (b) Doppler가 0/약함이어도 위치 변화가 사람 보폭 이상 → 실제 이동.
          //     iOS speed=0 케이스(샘플 직후, 약한 신호 등)를 누락하지 않게 해주는 핵심 분기.
          deltaKm = dist;
        } else {
          // (c) Doppler 약함 + 위치도 거의 안 변함 → 정지 상태로 간주
          gpsDiag.distSkipCount++;
          continue;
        }

        // ── Accumulate ───────────────────────────────────────────────────────
        if (isPausedForAccum) {
          gpsDiag.distSkipCount++;
          continue;
        }
        const newAccum = readAccum() + deltaKm;
        setString(ACCUM_KEY, String(newAccum));
        gpsDiag.acceptCount++;
        gpsDiag.totalAccumulatedKm = newAccum;
      }

      // ── Background race event (boxbox / fullPush) ──────────────────────────
      // 루프 후 1회만 평가 — 중복 발화 방지.
      // 잠금/백그라운드 상태에서도 적절한 시점에 사운드/LA update가 콜백 생명주기
      // 안에서 완료되도록 기다린다. fire-and-forget이면 iOS가 JS를 다시 suspend할 때
      // 후속 async 작업이 유실될 수 있다.
      await maybeFireBackgroundRaceEvents().catch(() => {});
    });
    gpsDiag.defineCalled = true;
  } catch (e) {
    gpsDiag.defineError = 'defineTask threw: ' + String(e);
  }
}

/**
 * index.ts에서 defineBackgroundLocationTask 호출 직후 호출 — 등록이 실제로
 * 적용됐는지 확인용. 결과를 gpsDiag.earlyReg에 기록.
 */
export async function probeBackgroundTaskRegistration(): Promise<void> {
  try {
    const reg = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    gpsDiag.earlyReg = reg;
  } catch (e) {
    gpsDiag.earlyRegError = String(e).slice(0, 200);
  }
  try {
    const tasks = await TaskManager.getRegisteredTasksAsync();
    gpsDiag.earlyRegTasks = JSON.stringify(tasks.map((t) => t.taskName));
  } catch (e) {
    gpsDiag.earlyRegTasks = 'err:' + String(e).slice(0, 80);
  }
}

export async function startBackgroundLocationTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  gpsDiag.taskRegistered = isRegistered;

  // FIX 10-A: ghost-proof start.
  // hasStartedLocationUpdatesAsync=true인 유령 task를 재사용하면 GPS 측정이
  // 안 되거나 트리클(callback 2~3개/세션) 문제가 발생.
  // isStarted=true면 먼저 stop하고 항상 fresh start. pre-stop 실패해도 진행.
  const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  gpsDiag.taskStarted = false; // "이번 세션 fresh start 성공" 의미로 재정의
  if (isStarted) {
    gpsDiag.ghostCleared++;
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch((e) => {
      gpsDiag.startError = 'pre-stop fail: ' + String(e).slice(0, 80);
    });
  }

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      // activityType: Fitness — 러닝앱 적합. Apple 백그라운드 정지 조건과 무관.
      activityType: debugGpsConfig.useFitnessActivityType
        ? Location.LocationActivityType.Fitness
        : Location.LocationActivityType.Other,
      timeInterval: 1000,
      // FIX 12: distanceInterval 제거 — iOS 16.4+ 백그라운드 정지 조건 회피.
      // Apple DTS 공식 답변: startUpdatingLocation + startMonitoringSignificantLocationChanges를
      // 둘 다 호출(expo-location EXLocationTaskConsumer.m L76-77)하면서 distanceFilter != None이면
      // 백그라운드에서 suspend 가능. distanceInterval: 1 → distanceFilter = 1m → 정지 조건 트리거.
      // 거리 누적은 JS haversine + accuracy 게이트(50/100m)로 직접 처리하므로 native 필터 불필요.
      foregroundService: {
        notificationTitle: 'Pit Run',
        notificationBody: '러닝 세션이 진행 중입니다',
        notificationColor: COLORS.bg,
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    gpsDiag.startResolved = true;
    gpsDiag.taskStarted = true;
  } catch (e) {
    gpsDiag.startResolved = false;
    gpsDiag.startError = 'startLocationUpdatesAsync threw: ' + String(e).slice(0, 200);
    throw e;
  }
}

export async function stopBackgroundLocationTask(): Promise<void> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch((e) => {
      gpsDiag.startError = 'stop fail: ' + String(e).slice(0, 80);
    });
  }
}

/**
 * 앱 부팅 시 stale background task 정리 — 1차 방어선.
 *
 * 시나리오: race 진행 중 사용자가 앱 swipe kill → useGPS cleanup 미실행 →
 * background task가 OS 레벨에서 계속 살아남음 → 잠금화면 GPS 아이콘 유지 +
 * boxbox 사운드 발화. 다음 앱 부팅 시 이 함수가 그 task를 정리.
 *
 * 정책:
 *   - task가 등록 + started 상태이고
 *   - activeRacePlan이 없으면 (= race 진행 중이 아님)
 *   → stopLocationUpdatesAsync + clearBackgroundCoords
 *
 * plan이 있으면 race가 정상 진행 중인 케이스(앱이 백그라운드에서 살아 부팅됨)와
 * stale plan이 남은 비정상 케이스 둘 다 가능. 비정상 케이스는 isRunning 가드가
 * maybeFireBackgroundRaceEvents에서 차단.
 *
 * 호출 시점: index.ts에서 defineBackgroundLocationTask 직후 1회.
 */
export async function cleanupStaleBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) return;
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
    if (!isStarted) return;
    const plan = getActiveRacePlan();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const isStale = plan && plan.startedAtMs
      ? Date.now() - plan.startedAtMs > TWELVE_HOURS_MS
      : false;
    if (!plan || isStale) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch((e) => {
        console.warn('[cleanupStaleBackgroundTask] stop fail:', e);
      });
      clearBackgroundCoords();
      if (isStale) clearActiveRacePlan();
    }
  } catch (e) {
    console.warn('[cleanupStaleBackgroundTask]', e);
  }
}

/** 누적 거리(km) 읽기 — foreground polling에서 사용 */
export function getAccumulatedKm(): number {
  return readAccum();
}

/** 새 레이스 시작 시 모든 상태 초기화 */
export function clearBackgroundCoords(): void {
  remove(LATEST_KEY);
  remove(PREV_KEY);
  setString(ACCUM_KEY, '0');
}

// v1 compat exports
export type BackgroundCoords = StoredCoords;
export function getLatestBackgroundCoords(): BackgroundCoords | null {
  const raw = getString(LATEST_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as BackgroundCoords; }
  catch { return null; }
}
