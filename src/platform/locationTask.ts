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

// Thresholds
// accuracy 필터 제거: 거리 측정 목적에서 accuracy 제한은 긴 gap을 만들어 과소 측정을 유발함.
// 대신 시간비례 동적 상한으로 GPS 텔레포트 노이즈만 걸러냄.
const MIN_DELTA_KM   = 0.0005; // 0.5 m — 정지 시 GPS 미세 떨림 제거
const MIN_SPEED_MS   = 0.5;    // 0.5 m/s — 거의 정지 상태 필터
const MAX_SPEED_KM_S = 0.015;  // 15 m/s = 54 km/h — 달리기 한계 초과 시 GPS 노이즈로 간주
const MAX_DELTA_ABS  = 0.3;    // 300m 절대 상한 (긴 gap에서도 텔레포트 방어)

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

      // 모든 좌표를 PREV_KEY에 저장 — accuracy 필터 없이 gap 방지
      const prev = readPrev();
      setString(PREV_KEY, JSON.stringify(coords));

      if (!prev) return; // first valid reading — no delta yet

      // ── Distance + Speed filter ────────────────────────────────────────────
      const dist = haversineKm(prev, coords);
      gpsDiag.lastDist = dist;
      const dtSec = (coords.timestamp - prev.timestamp) / 1000;

      // 시간비례 동적 상한: 측정 간격(dtSec)이 길수록 더 큰 이동을 허용.
      // dtSec ≈ 1s (정상 1Hz 업데이트) → max ≈ 15m/s
      const dynamicMaxKm = dtSec > 0
        ? Math.min(MAX_DELTA_ABS, dtSec * MAX_SPEED_KM_S)
        : MAX_DELTA_ABS;

      if (dist < MIN_DELTA_KM || dist > dynamicMaxKm) {
        gpsDiag.distSkipCount++;
        return;
      }

      // ── Speed filter ───────────────────────────────────────────────────────
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
