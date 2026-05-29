/**
 * Background location task
 *
 * JS context is isolated from the foreground — direct Zustand access is impossible.
 *
 * Architecture (v2):
 *   - Background task calculates distance deltas and ACCUMULATES them in MMKV.
 *   - Foreground polls accumulated km every second and applies the delta to the store.
 *   - This fixes the lock-screen GPS bug: when the screen is locked the foreground
 *     JS thread is suspended (setInterval stops), but the background task keeps running
 *     and accumulating. When the screen comes back on, the foreground reads the full
 *     accumulated distance in one shot — no distance is lost.
 *
 * Previous architecture (v1) bug:
 *   - Background task wrote only LATEST coords to MMKV.
 *   - Foreground polled and called haversine(prevCoords, latestCoords).
 *   - When screen locked: setInterval suspended → prevCoords stale.
 *   - On resume: haversine(stale, current) could exceed MAX_DELTA_KM (150 m) and
 *     be discarded as teleportation noise → all distance during lock lost.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { COLORS } from '../constants/colors';
import { getString, setString, remove } from './storage';
import { gpsDiag } from './gpsDiag';
import { haversineKm, type LocationCoords } from './location';

export const BACKGROUND_LOCATION_TASK = 'pit-run-background-location';

// v1 compat key — kept so clearBackgroundCoords wipes it too
const LATEST_KEY   = 'bg_location_latest';
// v2 keys
const PREV_KEY     = 'bg_location_prev';    // last processed coords + timestamp
const ACCUM_KEY    = 'bg_location_accum_km'; // accumulated valid distance (km)

// Thresholds (same values as v1 useGPS, now enforced in background)
const MIN_ACCURACY_M = 50;
const MIN_DELTA_KM   = 0.0005; // 0.5 m — avoids stationary GPS jitter
const MAX_DELTA_KM   = 0.15;   // 150 m — per-step max (teleport guard per update)
const MIN_SPEED_MS   = 0.5;    // 0.5 m/s ≈ very slow shuffle

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
      const coords: StoredCoords = {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude:  loc.coords.altitude,
        accuracy:  loc.coords.accuracy,
        speed:     loc.coords.speed,
        timestamp: loc.timestamp,
      };

      gpsDiag.taskWriteCount++;
      gpsDiag.lastTaskWriteTs = loc.timestamp;

      // Keep LATEST_KEY for diagnostics (v1 compat)
      setString(LATEST_KEY, JSON.stringify(coords));

      // ── Accuracy filter ────────────────────────────────────────────────────
      if (coords.accuracy != null && coords.accuracy > MIN_ACCURACY_M) {
        gpsDiag.accSkipCount++;
        // Still update prev so next good reading has a recent reference
        setString(PREV_KEY, JSON.stringify(coords));
        return;
      }

      const prev = readPrev();
      setString(PREV_KEY, JSON.stringify(coords));

      if (!prev) return; // first valid reading — no delta yet

      // ── Distance filter ────────────────────────────────────────────────────
      const dist = haversineKm(prev, coords);
      gpsDiag.lastDist = dist;

      if (dist < MIN_DELTA_KM || dist > MAX_DELTA_KM) {
        gpsDiag.distSkipCount++;
        return;
      }

      // ── Speed filter ───────────────────────────────────────────────────────
      const dtSec = (coords.timestamp - prev.timestamp) / 1000;
      if (dtSec > 0 && (dist * 1000) / dtSec < MIN_SPEED_MS) {
        gpsDiag.distSkipCount++;
        return;
      }

      // ── Accumulate ─────────────────────────────────────────────────────────
      const newAccum = readAccum() + dist;
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

// v1 compat export (QualifyingScreen diagnostics 등에서 사용 가능성)
export type BackgroundCoords = StoredCoords;
export function getLatestBackgroundCoords(): BackgroundCoords | null {
  const raw = getString(LATEST_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as BackgroundCoords; }
  catch { return null; }
}
