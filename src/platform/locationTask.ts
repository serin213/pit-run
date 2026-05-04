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
import { getString, setString, remove } from './storage';

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
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
    if (error) return;
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations?.length) return;
    const loc = locations[locations.length - 1];
    const coords: BackgroundCoords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      timestamp: loc.timestamp,
    };
    setString(STORAGE_KEY, JSON.stringify(coords));
  });
}

export async function startBackgroundLocationTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (!isRegistered) return;

  const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isStarted) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 1,
    foregroundService: {
      notificationTitle: 'Pit Run',
      notificationBody: '러닝 세션이 진행 중입니다',
      notificationColor: '#17171C',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
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
