import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useRunStore } from '../store/runStore';

const LOCATION_TASK = 'background-location-task';

/**
 * GPS 위치 추적 훅
 * 실제 앱에서는 시뮬레이션 tick 대신 이 훅이 distKm을 업데이트
 * 개발 시뮬레이터에서는 시뮬레이션 모드 사용
 */
export function useGPS(enabled: boolean) {
  const prevLocationRef = useRef<Location.LocationObject | null>(null);
  const { isRunning, isPaused } = useRunStore();

  useEffect(() => {
    if (!enabled || !isRunning || isPaused) return;

    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          if (prevLocationRef.current) {
            const dist = haversineKm(
              prevLocationRef.current.coords,
              location.coords,
            );
            // TODO: useRunStore에 addGpsDistance 액션 추가 후 연결
            // useRunStore.getState().addGpsDistance(dist);
          }
          prevLocationRef.current = location;
        },
      );
    })();

    return () => { sub?.remove(); };
  }, [enabled, isRunning, isPaused]);
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
