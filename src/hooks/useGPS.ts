import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRunStore } from '../store/runStore';
import {
  requestForegroundPermission,
  requestBackgroundPermission,
} from '../platform/location';
import {
  startBackgroundLocationTask,
  stopBackgroundLocationTask,
  getAccumulatedKm,
  clearBackgroundCoords,
} from '../platform/locationTask';
import { gpsDiag } from '../platform/gpsDiag';

const POLL_INTERVAL_MS = 1000;

/**
 * Background location task 기반 GPS 측정 (v2).
 *
 * 거리 계산·누적은 background task(locationTask.ts)에서 처리.
 * Foreground는 1초마다 누적값을 읽어 delta를 onDistance 콜백으로 전달.
 *
 * 잠금화면 GPS 수정:
 *   - v1: foreground setInterval이 haversine 계산 → 화면 잠금 시 suspend → 거리 유실
 *   - v2: background task가 모든 GPS 업데이트마다 거리 누적 → foreground는 결과만 읽음
 *
 * enabled false → task 중지. true → 권한 요청 + task 시작 + 1초마다 polling.
 */
export function useGPS(enabled: boolean, onDistance: (deltaKm: number) => void) {
  const lastAppliedAccumRef = useRef<number>(0);
  // onDistance를 ref로 잡아 effect가 deps 변화로 재시작되지 않게.
  const onDistanceRef = useRef(onDistance);
  onDistanceRef.current = onDistance;
  const { setGpsEnabled } = useRunStore();

  useEffect(() => {
    gpsDiag.enabled = enabled;
    if (!enabled) {
      lastAppliedAccumRef.current = 0;
      return;
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let appStateSubscription: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const foregroundGranted = await requestForegroundPermission();
      gpsDiag.fgPerm = foregroundGranted;
      if (!foregroundGranted || cancelled) return;

      // Background permission: best-effort (always 권한 못 받아도 foreground 동안엔 동작)
      const bgGranted = await requestBackgroundPermission().catch(() => false);
      gpsDiag.bgPerm = bgGranted;

      // 누적 카운터 및 MMKV 좌표 초기화
      clearBackgroundCoords();
      lastAppliedAccumRef.current = 0;
      setGpsEnabled(true);

      try {
        await startBackgroundLocationTask();
      } catch (e) {
        console.warn('[useGPS] startBackgroundLocationTask failed:', e);
        if (!cancelled) setGpsEnabled(false);
        return;
      }
      if (cancelled) {
        await stopBackgroundLocationTask();
        return;
      }

      // 1초마다 background 누적 거리를 읽어 delta 전달
      const drainAccum = () => {
        gpsDiag.tick++;
        const accum = getAccumulatedKm();
        const delta = accum - lastAppliedAccumRef.current;
        if (delta > 0) {
          lastAppliedAccumRef.current = accum;
          onDistanceRef.current(delta);
        }
      };
      pollInterval = setInterval(drainAccum, POLL_INTERVAL_MS);

      // AppState 'active' 전환 시 즉시 sync.
      // JS thread는 화면 잠금 시 suspend됨 → setInterval도 정지 → background task가
      // MMKV에 거리는 계속 쌓아도 RN state는 다음 폴링까지 멈춰있음.
      // 잠금 해제 직후 setInterval이 깨어나려면 최대 1초 대기 → 그동안 큰 delta가
      // 한 번에 들어와 화면이 "점프 업데이트"되는 현상 발생.
      // 'active' 이벤트 발생 즉시 drain → 점프 폭 최소화 (1초 → 즉시).
      appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') drainAccum();
      });
    })();

    return () => {
      gpsDiag.cleanupCount++;
      cancelled = true;
      lastAppliedAccumRef.current = 0;
      if (pollInterval) clearInterval(pollInterval);
      if (appStateSubscription) appStateSubscription.remove();
      stopBackgroundLocationTask();
      setGpsEnabled(false);
    };
  }, [enabled, setGpsEnabled]);
}
