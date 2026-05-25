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

// Apple 공식 워크아웃 라우트 예제도 50m. 이전 20m는 도시 환경에서 너무 엄격.
const MIN_ACCURACY_M = 50;
const MIN_DELTA_KM = 0.002;
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
export function useGPS(enabled: boolean, onDistance: (deltaKm: number) => void) {
  const prevCoordsRef = useRef<LocationCoords | null>(null);
  const lastTimestampRef = useRef<number>(0);
  // onDistance를 ref로 잡아 effect가 deps 변화로 재시작되지 않게.
  const onDistanceRef = useRef(onDistance);
  onDistanceRef.current = onDistance;
  const { setGpsEnabled } = useRunStore();

  useEffect(() => {
    console.log('[GPS-DIAG] useGPS effect enabled=' + enabled);
    if (!enabled) {
      prevCoordsRef.current = null;
      lastTimestampRef.current = 0;
      return;
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let pollTickCount = 0;
    let pollNullCount = 0;
    let pollAccSkipCount = 0;
    let pollDistSkipCount = 0;
    let pollAcceptCount = 0;

    (async () => {
      const foregroundGranted = await requestForegroundPermission();
      console.log('[GPS-DIAG] foreground permission granted=' + foregroundGranted);
      if (!foregroundGranted || cancelled) return;

      // Background permission: best-effort (always 권한 못 받아도 foreground 동안엔 동작)
      const bgGranted = await requestBackgroundPermission().catch(() => false);
      console.log('[GPS-DIAG] background permission granted=' + bgGranted);

      clearBackgroundCoords();
      lastTimestampRef.current = 0;
      prevCoordsRef.current = null;
      setGpsEnabled(true);

      await startBackgroundLocationTask();
      if (cancelled) {
        await stopBackgroundLocationTask();
        return;
      }

      pollInterval = setInterval(() => {
        pollTickCount++;
        const bg = getLatestBackgroundCoords();
        if (!bg) {
          pollNullCount++;
          if (pollTickCount % 5 === 0) {
            console.log('[GPS-DIAG] poll tick=' + pollTickCount + ' null=' + pollNullCount + ' acc-skip=' + pollAccSkipCount + ' dist-skip=' + pollDistSkipCount + ' accept=' + pollAcceptCount);
          }
          return;
        }
        if (bg.timestamp <= lastTimestampRef.current) return;

        lastTimestampRef.current = bg.timestamp;

        const coords: LocationCoords = {
          latitude: bg.latitude,
          longitude: bg.longitude,
          altitude: bg.altitude,
          accuracy: bg.accuracy,
          speed: bg.speed,
        };

        if (coords.accuracy != null && coords.accuracy > MIN_ACCURACY_M) {
          pollAccSkipCount++;
          console.log('[GPS-DIAG] poll skip accuracy=' + coords.accuracy);
          return;
        }

        if (prevCoordsRef.current) {
          const dist = haversineKm(prevCoordsRef.current, coords);
          if (dist >= MIN_DELTA_KM && dist <= MAX_DELTA_KM) {
            pollAcceptCount++;
            console.log('[GPS-DIAG] poll accept dist=' + dist.toFixed(5) + ' acc=' + coords.accuracy);
            onDistanceRef.current(dist);
          } else {
            pollDistSkipCount++;
            console.log('[GPS-DIAG] poll dist-skip dist=' + dist.toFixed(5));
          }
        } else {
          console.log('[GPS-DIAG] poll first coord (prev=null, skip)');
        }
        prevCoordsRef.current = coords;
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      console.log('[GPS-DIAG] useGPS cleanup ticks=' + pollTickCount + ' null=' + pollNullCount + ' acc-skip=' + pollAccSkipCount + ' dist-skip=' + pollDistSkipCount + ' accept=' + pollAcceptCount);
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      stopBackgroundLocationTask();
      setGpsEnabled(false);
    };
  }, [enabled, setGpsEnabled]);
}
