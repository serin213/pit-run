import { useEffect, useRef } from 'react';
import { useRunStore } from '../store/runStore';
import {
  requestForegroundPermission,
  requestBackgroundPermission,
  haversineKm,
  type LocationCoords,
} from '../platform/location';
import {
  startBackgroundLocationTask,
  stopBackgroundLocationTask,
  getLatestBackgroundCoords,
  clearBackgroundCoords,
} from '../platform/locationTask';

const MIN_ACCURACY_M = 20;
const MIN_DELTA_KM = 0.002;
const MAX_DELTA_KM = 0.15;
const POLL_INTERVAL_MS = 1000;

export function useGPS(enabled: boolean) {
  const prevCoordsRef = useRef<LocationCoords | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const { isRunning, isPaused, setGpsEnabled } = useRunStore();

  useEffect(() => {
    if (!enabled || !isRunning || isPaused) return;

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      const foregroundGranted = await requestForegroundPermission();
      if (!foregroundGranted || cancelled) return;

      // Background permission: best-effort (Android requires separate grant)
      await requestBackgroundPermission().catch(() => {});

      clearBackgroundCoords();
      lastTimestampRef.current = 0;
      setGpsEnabled(true);

      await startBackgroundLocationTask();
      if (cancelled) {
        await stopBackgroundLocationTask();
        return;
      }

      pollInterval = setInterval(() => {
        const bg = getLatestBackgroundCoords();
        if (!bg || bg.timestamp <= lastTimestampRef.current) return;

        lastTimestampRef.current = bg.timestamp;

        const coords: LocationCoords = {
          latitude: bg.latitude,
          longitude: bg.longitude,
          altitude: bg.altitude,
          accuracy: bg.accuracy,
          speed: bg.speed,
        };

        if (coords.accuracy != null && coords.accuracy > MIN_ACCURACY_M) return;

        if (prevCoordsRef.current) {
          const dist = haversineKm(prevCoordsRef.current, coords);
          if (dist >= MIN_DELTA_KM && dist <= MAX_DELTA_KM) {
            useRunStore.getState().addGpsDistance(dist);
          }
        }
        prevCoordsRef.current = coords;
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      stopBackgroundLocationTask();
    };
  }, [enabled, isRunning, isPaused, setGpsEnabled]);

  useEffect(() => {
    if (!isRunning) {
      prevCoordsRef.current = null;
      lastTimestampRef.current = 0;
    }
  }, [isRunning]);
}
