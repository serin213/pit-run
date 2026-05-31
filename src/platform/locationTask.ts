/**
 * Background location task
 *
 * JS context is isolated from the foreground — direct Zustand access is impossible.
 *
 * Architecture (v3 — industry-standard algorithm):
 *
 *   Layer 1 — Validity gate (don't touch PREV_KEY):
 *     - Stale: timestamp > 10 s from now → skip entirely
 *     - Invalid fix: accuracy < 0 → skip entirely
 *
 *   Layer 2 — PREV_KEY update (unconditional after validity gate):
 *     Always update PREV_KEY before any distance filter.
 *     This prevents the v1 bug: accuracy filter → long gap → MAX_DELTA exceeded → good
 *     movement discarded. PREV_KEY = "last known position regardless of quality".
 *
 *   Layer 3 — Distance quality gate (PREV_KEY updated, distance skipped):
 *     - accuracy > MAX_ACCURACY_M (100 m) → position too noisy, skip distance only
 *
 *   Layer 4 — Teleport filter:
 *     - implied speed from haversine/timeDelta > MAX_RUNNING_MS (10 m/s = 36 km/h) → skip
 *
 *   Layer 5 — Distance accumulation (Doppler-first):
 *     a) Doppler speed (loc.speed ≥ 0, i.e. iOS Doppler valid):
 *        - speed < MIN_SPEED_MS (0.3 m/s) → stationary, skip
 *        - accumulate: speed_m/s × dtSec  (km)
 *     b) Haversine fallback (loc.speed < 0, Doppler unavailable):
 *        - dist < MIN_DELTA_KM (0.5 m) → stationary drif, skip
 *        - accumulate: haversine dist (km)
 *
 * Why Doppler-first?
 *   iOS CLLocation.speed is derived from satellite Doppler shift — independent of
 *   positional noise. Freeletics measured 7% raw GPS error → 1.7% with Doppler
 *   integration. Haversine between noisy positions amplifies position errors; Doppler
 *   doesn't. Android FusedLocationProvider also provides Doppler speed on most chipsets.
 *
 * References:
 *   - Freeletics Engineering (2019): iOS GPS Testing with Kalman filter
 *   - Nike+, Strava engineering: accuracy threshold 50–100 m, speed-gate 10 m/s
 *   - mad-location-manager (maddevsio): GeoHash + Kalman (open source reference)
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { COLORS } from '../constants/colors';
import { getString, setString, remove } from './storage';
import { gpsDiag } from './gpsDiag';
import { haversineKm, type LocationCoords } from './location';

export const BACKGROUND_LOCATION_TASK = 'pit-run-background-location';

// Storage keys
const LATEST_KEY  = 'bg_location_latest';   // v1 compat (diagnostics only)
const PREV_KEY    = 'bg_location_prev';      // last processed coords + timestamp
const ACCUM_KEY   = 'bg_location_accum_km'; // accumulated valid distance (km)

// ── Filter constants ─────────────────────────────────────────────────────────
/** 100 m 초과 accuracy 읽기는 GPS noise가 너무 커서 distance 누적 스킵.
 *  PREV_KEY는 여전히 업데이트 → gap 발생 방지. */
const MAX_ACCURACY_M   = 100;
/** 10 초 이상 된 stale 읽기는 완전 스킵 (iOS cached location 방어). */
const MAX_STALE_MS     = 10_000;
/** 10 m/s = 36 km/h — 달리기 최대 속도. 초과하면 GPS teleport로 간주. */
const MAX_RUNNING_MS   = 10;
/** Doppler 속도 0.3 m/s 미만 = 정지 상태. distance 누적 스킵. */
const MIN_SPEED_MS     = 0.3;
/** Haversine fallback: 0.5 m 미만 이동 = 정지 GPS 드리프트. 스킵. */
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
      const loc = locations[locations.length - 1];

      gpsDiag.taskWriteCount++;
      gpsDiag.lastTaskWriteTs = loc.timestamp;

      // ── Layer 1: Validity gate ──────────────────────────────────────────────
      // Stale: iOS delivers a cached last-known-location on first callback which
      // can be minutes old. Reject anything > 10 s old.
      const ageMs = Date.now() - loc.timestamp;
      if (ageMs > MAX_STALE_MS) {
        gpsDiag.distSkipCount++;
        return;
      }
      // Invalid fix: negative accuracy means no satellite fix at all.
      if ((loc.coords.accuracy ?? -1) < 0) {
        gpsDiag.distSkipCount++;
        return;
      }

      const coords: StoredCoords = {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude:  loc.coords.altitude,
        accuracy:  loc.coords.accuracy,
        speed:     loc.coords.speed,
        timestamp: loc.timestamp,
      };

      // Keep LATEST_KEY for diagnostics (v1 compat)
      setString(LATEST_KEY, JSON.stringify(coords));

      // ── Layer 2: Always update PREV_KEY ────────────────────────────────────
      // Must happen BEFORE any distance quality gate so the next reading always
      // has a recent reference point — prevents the "long gap → MAX_DELTA bust" bug.
      const prev = readPrev();
      setString(PREV_KEY, JSON.stringify(coords));

      if (!prev) return; // first valid reading, no delta yet

      const dist  = haversineKm(prev, coords);
      const dtSec = (coords.timestamp - prev.timestamp) / 1000;

      gpsDiag.lastDist = dist;

      if (dtSec <= 0) return;

      // ── Layer 3: Distance quality gate ─────────────────────────────────────
      // Position too noisy to trust as a distance reference.
      // PREV_KEY is already updated above, so the next reading will use this
      // (potentially inaccurate) position as origin — acceptable because the
      // distance filter below still blocks teleport.
      if ((coords.accuracy ?? 0) > MAX_ACCURACY_M) {
        gpsDiag.distSkipCount++;
        return;
      }

      // ── Layer 4: Teleport filter ────────────────────────────────────────────
      // If implied speed (from haversine / time) exceeds human running speed,
      // the GPS jumped — discard.
      const impliedSpeedMs = (dist * 1000) / dtSec;
      if (impliedSpeedMs > MAX_RUNNING_MS) {
        gpsDiag.distSkipCount++;
        return;
      }

      // ── Layer 5: Distance accumulation (Doppler-first) ─────────────────────
      const dopplerSpeed = coords.speed ?? -1; // m/s; -1 = invalid on iOS
      let deltaKm: number;

      if (dopplerSpeed >= 0) {
        // Doppler speed available (iOS CLLocation.speed from satellite carrier shift).
        // Independent of positional noise — more accurate than haversine for distance.
        if (dopplerSpeed < MIN_SPEED_MS) {
          gpsDiag.distSkipCount++;
          return; // stationary
        }
        deltaKm = (dopplerSpeed * dtSec) / 1000;
      } else {
        // Doppler unavailable — haversine fallback.
        if (dist < MIN_DELTA_KM) {
          gpsDiag.distSkipCount++;
          return; // GPS drift while stationary
        }
        deltaKm = dist;
      }

      // ── Accumulate ─────────────────────────────────────────────────────────
      const newAccum = readAccum() + deltaKm;
      setString(ACCUM_KEY, String(newAccum));
      gpsDiag.acceptCount++;
      gpsDiag.totalAccumulatedKm = newAccum;
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

  const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  gpsDiag.taskStarted = isStarted;
  if (isStarted) return;

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 1,
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
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
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
