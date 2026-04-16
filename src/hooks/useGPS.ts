import { useEffect, useRef } from 'react';
import { useRunStore } from '../store/runStore';
import {
  requestForegroundPermission,
  watchPosition,
  haversineKm,
  type LocationCoords,
  type LocationSubscription,
} from '../platform/location';

/**
 * GPS 위치 추적 훅
 * platform/location.ts 추상화를 통해 위치 데이터를 받음.
 * 미니앱 전환 시 platform/location.ts만 교체하면 됨.
 */
export function useGPS(enabled: boolean) {
  const prevCoordsRef = useRef<LocationCoords | null>(null);
  const { isRunning, isPaused } = useRunStore();

  useEffect(() => {
    if (!enabled || !isRunning || isPaused) return;

    let sub: LocationSubscription | null = null;

    (async () => {
      const granted = await requestForegroundPermission();
      if (!granted) return;

      sub = await watchPosition((coords) => {
        if (prevCoordsRef.current) {
          const dist = haversineKm(prevCoordsRef.current, coords);
          // TODO: useRunStore에 addGpsDistance 액션 추가 후 연결
          // useRunStore.getState().addGpsDistance(dist);
        }
        prevCoordsRef.current = coords;
      });
    })();

    return () => {
      sub?.remove();
    };
  }, [enabled, isRunning, isPaused]);
}
