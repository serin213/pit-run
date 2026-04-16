import { useEffect, useRef, useState } from 'react';

/**
 * Practice 화면용 거리(km) 트래커.
 *
 * 현재 구현: 시간 경과 기반 시뮬레이션 (RunningScreen과 동일하게 GPS 미연결 상태)
 * 추후 GPS 연결 시 이 훅 내부만 useGPS 결과로 교체하면 됨 — 호출부 수정 불필요.
 */
export function usePracticeDistance(paused: boolean): number {
  const [distKm, setDistKm] = useState(0);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) {
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
  }, [paused]);

  return distKm;
}
