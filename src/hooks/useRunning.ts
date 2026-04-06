import { useEffect, useRef } from 'react';
import { useRunStore } from '../store/runStore';
import { TIRES } from '../constants/tires';

/**
 * 러닝 루프를 관리하는 훅
 * requestAnimationFrame 기반으로 매 프레임 tick 호출
 * BOX BOX 자동 트리거 포함
 */
export function useRunning() {
  const { isRunning, isPaused, tick } = useRunStore();
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
      return;
    }

    const loop = (ts: number) => {
      if (!isPaused && lastTsRef.current !== null) {
        const dt = ts - lastTsRef.current;
        tick(dt);
        checkBoxBox();
      }
      if (isPaused) lastTsRef.current = null;
      else lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, isPaused]);

  function checkBoxBox() {
    const { distKm, tire, boxBoxActive, pitPhase, triggerBoxBox } = useRunStore.getState();
    if (boxBoxActive || pitPhase !== 'none') return;
    const threshold = TIRES[tire].boxBoxDistKm;
    if (distKm > 0 && distKm % threshold < 0.005) {
      triggerBoxBox();
    }
  }
}
