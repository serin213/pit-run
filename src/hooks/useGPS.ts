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
import { gpsDiag } from '../platform/gpsDiag';

// Apple 공식 워크아웃 라우트 예제도 50m. 이전 20m는 도시 환경에서 너무 엄격.
const MIN_ACCURACY_M = 50;
// 빌드 45 진단: 정상 걷기 1m/s 페이스에서 1초당 ~1m 이동인데 MIN_DELTA_KM=0.002(2m)
// 임계값에 매번 걸려 90% skip (실제 1.7km → 측정 1km, distSkip=90, accept=13). 50cm로
// 완화. GPS noise는 MIN_ACCURACY_M(50m)으로 1차 차단. 더 낮추면 정지 시 noise 누적.
const MIN_DELTA_KM = 0.0005;
const MAX_DELTA_KM = 0.15;
const POLL_INTERVAL_MS = 1000;

/**
 * Background location task 기반 GPS 측정.
 *
 * RunningScreen과 QualifyingScreen 양쪽에서 사용. 두 화면이 누적 대상이 다르므로
 * (RunningScreen은 useRunStore의 grand prix 거리, QualifyingScreen은 local
 * trialDistKm) onDistance 콜백을 받아 호출부가 누적 방식 결정.
 *
 * enabled false → task 중지. true → 권한 요청 + task 시작 + 1초마다 polling.
 */
export function useGPS(enabled: boolean, onDistance: (deltaKm: number, dtSec?: number) => void) {
  const prevCoordsRef = useRef<LocationCoords | null>(null);
  const lastTimestampRef = useRef<number>(0);
  // onDistance를 ref로 잡아 effect가 deps 변화로 재시작되지 않게.
  const onDistanceRef = useRef(onDistance);
  onDistanceRef.current = onDistance;
  const { setGpsEnabled } = useRunStore();

  useEffect(() => {
    gpsDiag.enabled = enabled;
    if (!enabled) {
      prevCoordsRef.current = null;
      lastTimestampRef.current = 0;
      return;
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      const foregroundGranted = await requestForegroundPermission();
      gpsDiag.fgPerm = foregroundGranted;
      if (!foregroundGranted || cancelled) return;

      // Background permission: best-effort (always 권한 못 받아도 foreground 동안엔 동작)
      const bgGranted = await requestBackgroundPermission().catch(() => false);
      gpsDiag.bgPerm = bgGranted;

      clearBackgroundCoords();
      lastTimestampRef.current = 0;
      prevCoordsRef.current = null;
      setGpsEnabled(true);

      try {
        await startBackgroundLocationTask();
      } catch (e) {
        // startLocationUpdatesAsync 실패 시 unhandled rejection → 앱 크래시 방지.
        // gpsDiag.startError는 locationTask 내부에서 이미 기록됨.
        console.warn('[useGPS] startBackgroundLocationTask failed:', e);
        if (!cancelled) setGpsEnabled(false);
        return;
      }
      if (cancelled) {
        await stopBackgroundLocationTask();
        return;
      }

      pollInterval = setInterval(() => {
        gpsDiag.tick++;
        const bg = getLatestBackgroundCoords();
        if (!bg) {
          gpsDiag.nullCount++;
          return;
        }
        if (bg.timestamp <= lastTimestampRef.current) return;

        // GPS 읽기 간격(초): 속도 필터에 전달 (첫 읽기는 undefined)
        const dtSec = lastTimestampRef.current > 0
          ? (bg.timestamp - lastTimestampRef.current) / 1000
          : undefined;
        lastTimestampRef.current = bg.timestamp;

        const coords: LocationCoords = {
          latitude: bg.latitude,
          longitude: bg.longitude,
          altitude: bg.altitude,
          accuracy: bg.accuracy,
          speed: bg.speed,
        };

        gpsDiag.lastAccuracy = coords.accuracy;

        if (coords.accuracy != null && coords.accuracy > MIN_ACCURACY_M) {
          gpsDiag.accSkipCount++;
          return;
        }

        if (prevCoordsRef.current) {
          const dist = haversineKm(prevCoordsRef.current, coords);
          gpsDiag.lastDist = dist;
          if (dist >= MIN_DELTA_KM && dist <= MAX_DELTA_KM) {
            gpsDiag.acceptCount++;
            gpsDiag.totalAccumulatedKm += dist;
            onDistanceRef.current(dist, dtSec);
          } else {
            gpsDiag.distSkipCount++;
          }
        }
        prevCoordsRef.current = coords;
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      gpsDiag.cleanupCount++;
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      stopBackgroundLocationTask();
      setGpsEnabled(false);
    };
  }, [enabled, setGpsEnabled]);
}
