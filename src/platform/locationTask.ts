/**
 * Background location task
 *
 * JS context is isolated from the foreground — direct Zustand access is impossible.
 * Bridge: task writes latest coords to MMKV; foreground polls MMKV every second.
 *
 * Must call defineBackgroundLocationTask() at module scope in index.ts
 * (before registerRootComponent) so the task is registered before any app code runs.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { COLORS } from '../constants/colors';
import { getString, setString, remove } from './storage';
import { gpsDiag } from './gpsDiag';

export const BACKGROUND_LOCATION_TASK = 'pit-run-background-location';
const STORAGE_KEY = 'bg_location_latest';

export type BackgroundCoords = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
};

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
      const coords: BackgroundCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        timestamp: loc.timestamp,
      };
      gpsDiag.taskWriteCount++;
      gpsDiag.lastTaskWriteTs = loc.timestamp;
      setString(STORAGE_KEY, JSON.stringify(coords));
    });
    gpsDiag.defineCalled = true;
  } catch (e) {
    gpsDiag.defineError = 'defineTask threw: ' + String(e);
  }
}

/**
 * index.ts에서 defineBackgroundLocationTask 호출 직후 호출 — 등록이 실제로
 * 적용됐는지 확인용. 결과를 gpsDiag.earlyReg에 기록. 또한 모든 등록된
 * task 이름을 dump해서 expo-task-manager native가 살아있는지 확인.
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
  // NOTE: 이전 코드는 isTaskRegisteredAsync가 false이면 early return하는 가드를
  // 가지고 있었음. 빌드 44 진단 결과 isTaskRegisteredAsync는 native task가 한
  // 번이라도 startLocationUpdatesAsync로 활성화된 적 있어야 true를 반환 — 즉
  // 첫 호출에선 무조건 false. 이 가드 때문에 startLocationUpdatesAsync까지
  // 도달 못해서 GPS가 영구 차단됐음.
  //
  // 빌드 26에서 같은 코드인데 동작한 건 expo-location 55.1.4 → 55.1.10 사이
  // native 동작 변경 추정. 현재는 isRegistered 결과를 진단 용도로만 기록하고
  // start까지 진행.
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

export function getLatestBackgroundCoords(): BackgroundCoords | null {
  const raw = getString(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BackgroundCoords;
  } catch {
    return null;
  }
}

export function clearBackgroundCoords(): void {
  remove(STORAGE_KEY);
}
