import { useEffect, useRef, useState } from 'react';
import {
  requestForegroundPermission,
  watchPosition,
  haversineKm,
  type LocationCoords,
  type LocationSubscription,
} from '../platform/location';

const MIN_ACCURACY_M = 20;
const MIN_DELTA_KM = 0.002;
const MAX_DELTA_KM = 0.15;

/**
 * Practice 화면용 거리(km) 트래커.
 *
 * GPS 권한이 있으면 실측 거리 사용.
 * 권한 없거나 GPS 불가 시 시간 기반 시뮬레이션 폴백.
 */
export function usePracticeDistance(paused: boolean): number {
  const [distKm, setDistKm] = useState(0);
  const [gpsActive, setGpsActive] = useState(false);
  const prevCoordsRef = useRef<LocationCoords | null>(null);
  const lastTickRef = useRef<number | null>(null);

  // GPS 추적
  useEffect(() => {
    if (paused) {
      prevCoordsRef.current = null;
      return;
    }

    let sub: LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const granted = await requestForegroundPermission();
      if (!granted || cancelled) return;

      setGpsActive(true);

      sub = await watchPosition((coords) => {
        if (coords.accuracy != null && coords.accuracy > MIN_ACCURACY_M) return;

        if (prevCoordsRef.current) {
          const dist = haversineKm(prevCoordsRef.current, coords);
          if (dist >= MIN_DELTA_KM && dist <= MAX_DELTA_KM) {
            setDistKm((prev) => prev + dist);
          }
        }
        prevCoordsRef.current = coords;
      });
      if (cancelled) sub?.remove();
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [paused]);

  // 시뮬레이션 폴백 (GPS 미연결 시)
  useEffect(() => {
    if (paused || gpsActive) {
      lastTickRef.current = null;
      return;
    }
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const last = lastTickRef.current ?? now;
      const dtSec = (now - last) / 1000;
      lastTickRef.current = now;
      // 시뮬레이션: 5min/km 페이스 (= 1km / 300s)
      setDistKm((prev) => prev + dtSec / 300);
    }, 100);
    return () => clearInterval(id);
  }, [paused, gpsActive]);

  return distKm;
}
