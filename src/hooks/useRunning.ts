import { useEffect, useRef } from 'react';
import { useRunStore } from '../store/runStore';
import { useAppStore } from '../store/appStore';
import { TIRES } from '../constants/tires';
import {
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
} from '../platform/liveActivity';

// Live Activity는 초당 1회로 throttle (ActivityKit 권고)
const LA_UPDATE_INTERVAL_MS = 1000;

export function useRunning() {
  const { isRunning, isPaused, tick } = useRunStore();
  const pitPhase = useRunStore(state => state.pitPhase);

  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activityIdRef = useRef<string | null>(null);
  const lastLAUpdateRef = useRef<number>(0);

  // isRunning 변화 → Live Activity 시작/종료
  useEffect(() => {
    if (isRunning) {
      if (!isLiveActivitySupported()) return;
      const { profile, selectedCircuitId } = useAppStore.getState();
      startLiveActivity(
        profile.displayName,
        profile.nameTagAccentColor,
        selectedCircuitId ?? 'shanghai',
      ).then(id => {
        activityIdRef.current = id;
      });
    } else {
      if (activityIdRef.current) {
        endLiveActivity(activityIdRef.current);
        activityIdRef.current = null;
      }
    }
  }, [isRunning]);

  // pitPhase 변화(BOX BOX 등) → 즉시 업데이트 (throttle 우회)
  useEffect(() => {
    const id = activityIdRef.current;
    if (!id) return;
    const { distKm, elapsedMs, paceS, sector, tire, prog } = useRunStore.getState();
    updateLiveActivity(id, {
      distKm,
      elapsedMs: Math.round(elapsedMs),
      paceS: Math.round(paceS),
      sector,
      tire,
      pitPhase,
      prog,
      isPaused,
    });
  }, [pitPhase]);

  // RAF 루프
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

        // throttled Live Activity update
        const id = activityIdRef.current;
        if (id && ts - lastLAUpdateRef.current >= LA_UPDATE_INTERVAL_MS) {
          lastLAUpdateRef.current = ts;
          const { distKm, elapsedMs, paceS, sector, tire, pitPhase: phase, prog } =
            useRunStore.getState();
          updateLiveActivity(id, {
            distKm,
            elapsedMs: Math.round(elapsedMs),
            paceS: Math.round(paceS),
            sector,
            tire,
            pitPhase: phase,
            prog,
            isPaused,
          });
        }
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
    const { distKm, tire, boxBoxActive, pitPhase: phase, triggerBoxBox } =
      useRunStore.getState();
    if (boxBoxActive || phase !== 'none') return;
    const threshold = TIRES[tire].boxBoxDistKm;
    if (distKm > 0 && distKm % threshold < 0.005) {
      triggerBoxBox();
    }
  }
}
