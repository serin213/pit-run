import { useEffect, useRef } from 'react';
import { useRunStore } from '../store/runStore';
import {
  requestForegroundPermission,
  watchPosition,
  haversineKm,
  type LocationCoords,
  type LocationSubscription,
} from '../platform/location';

/** GPS 위치 → 거리 필터링 상수 */
const MIN_ACCURACY_M = 20; // accuracy > 20m인 좌표는 무시
const MIN_DELTA_KM = 0.002; // 2m 미만 이동은 무시 (노이즈 방지)
const MAX_DELTA_KM = 0.15; // 150m 초과 점프는 무시 (GPS 튐 방지)

/**
 * GPS 위치 추적 훅
 * platform/location.ts 추상화를 통해 위치 데이터를 받고
 * runStore.addGpsDistance()로 실측 거리를 반영.
 */
export function useGPS(enabled: boolean) {
  const prevCoordsRef = useRef<LocationCoords | null>(null);
  const { isRunning, isPaused, setGpsEnabled } = useRunStore();

  useEffect(() => {
    if (!enabled || !isRunning || isPaused) {
      return;
    }

    let sub: LocationSubscription | null = null;

    (async () => {
      const granted = await requestForegroundPermission();
      if (!granted) return;

      setGpsEnabled(true);

      sub = await watchPosition((coords) => {
        // 정확도 낮은 좌표 무시
        if (coords.accuracy != null && coords.accuracy > MIN_ACCURACY_M) return;

        if (prevCoordsRef.current) {
          const dist = haversineKm(prevCoordsRef.current, coords);
          // 노이즈/GPS 튐 필터링
          if (dist >= MIN_DELTA_KM && dist <= MAX_DELTA_KM) {
            useRunStore.getState().addGpsDistance(dist);
          }
        }
        prevCoordsRef.current = coords;
      });
    })();

    return () => {
      sub?.remove();
    };
  }, [enabled, isRunning, isPaused, setGpsEnabled]);

  // 러닝 종료 시 GPS 상태 리셋
  useEffect(() => {
    if (!isRunning) {
      prevCoordsRef.current = null;
    }
  }, [isRunning]);
}
