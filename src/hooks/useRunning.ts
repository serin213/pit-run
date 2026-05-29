import { useEffect, useRef } from 'react';
import { useRunStore } from '../store/runStore';
import { useAppStore } from '../store/appStore';
import { TIRES } from '../constants/tires';
import { CIRCUITS } from '../config/circuits';
import {
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  getCurrentActivityId,
} from '../platform/liveActivity';

// Live Activity는 초당 1회로 throttle (ActivityKit 권고)
const LA_UPDATE_INTERVAL_MS = 1000;

interface UseRunningOptions {
  /** Fired once when the runner crosses into the last 1 km of the circuit. */
  onFinalLap?: () => void;
  /** Fired once when the runner reaches the full circuit distance. */
  onFinish?: () => void;
}

export function useRunning(options: UseRunningOptions = {}) {
  const { isRunning, isPaused, tick } = useRunStore();
  const pitPhase = useRunStore(state => state.pitPhase);

  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activityIdRef = useRef<string | null>(null);
  const lastLAUpdateRef = useRef<number>(0);
  const finalLapFiredRef = useRef(false);
  const finishFiredRef = useRef(false);
  const boxBoxTriggerCountRef = useRef(0);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-fresh callback refs so the RAF closure picks up the latest handlers.
  const onFinalLapRef = useRef(options.onFinalLap);
  const onFinishRef = useRef(options.onFinish);
  onFinalLapRef.current = options.onFinalLap;
  onFinishRef.current = options.onFinish;

  // isRunning 변화 → Live Activity 시작/종료
  // 자연 완주(pitPhase === 'completed')일 때는 종료를 ResultScreen 마운트로 위임 →
  // "Well done, mate" 상태가 잠금화면에 잠시 유지되도록.
  useEffect(() => {
    if (isRunning) {
      // If a previous completion is still waiting to auto-dismiss, end it now.
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
        completedTimerRef.current = null;
      }
      if (!isLiveActivitySupported()) {
        if (__DEV__) console.warn('[useRunning] LA not supported — skipping start');
        return;
      }
      const existing = getCurrentActivityId();
      if (existing) {
        if (__DEV__) console.log('[useRunning] LA reuse existing id', existing);
        activityIdRef.current = existing;
      } else {
        const { profile, selectedCircuitId } = useAppStore.getState();
        if (__DEV__) {
          console.log('[useRunning] LA start (no existing id)', {
            displayName: profile.displayName,
            teamColor: profile.nameTagAccentColor,
            circuit: selectedCircuitId ?? 'shanghai',
          });
        }
        startLiveActivity(
          profile.displayName,
          profile.nameTagAccentColor,
          selectedCircuitId ?? 'shanghai',
        )
          .then(id => {
            if (__DEV__) console.log('[useRunning] LA started, id =', id);
            activityIdRef.current = id;
          })
          .catch(e => {
            console.warn('[useRunning] LA start failed', e);
          });
      }
    } else {
      const phase = useRunStore.getState().pitPhase;
      const id = activityIdRef.current;
      if (id) {
        if (phase === 'completed') {
          // Natural finish: ResultScreen will dismiss the LA immediately on mount.
          // This timer is a fallback in case the user never reaches that screen.
          const idToEnd = id;
          activityIdRef.current = null;
          completedTimerRef.current = setTimeout(() => {
            endLiveActivity(idToEnd).catch(() => {});
            completedTimerRef.current = null;
          }, 10000);
        } else {
          // Manual stop / abandon: dismiss immediately.
          endLiveActivity(id);
          activityIdRef.current = null;
        }
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
      mode: 'race',
    });
  }, [pitPhase]);

  // RAF 루프
  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
      return;
    }

    finalLapFiredRef.current = false;
    finishFiredRef.current = false;
    boxBoxTriggerCountRef.current = 0;

    const loop = (ts: number) => {
      if (!isPaused && lastTsRef.current !== null) {
        const dt = ts - lastTsRef.current;
        tick(dt);
        checkBoxBox();
        checkLapMilestones();

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
            mode: 'race',
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

    const activePlan = useAppStore.getState().activePlan;

    // activePlan이 있으면 인터벌 기반, 없으면 타이어 기반 fallback (Practice 등)
    const intervalKm = activePlan
      ? activePlan.intervals.distanceM / 1000
      : TIRES[tire].boxBoxDistKm;
    const maxReps = activePlan ? activePlan.intervals.reps : Infinity;

    // 이미 모든 인터벌을 소화한 경우 더 이상 트리거 안 함 (cool-down)
    if (boxBoxTriggerCountRef.current >= maxReps) return;

    // distKm >= intervalKm 하한 필수: GPS 첫 틱(distKm ≈ 0.001)에서
    // 0.001 % intervalKm ≈ 0.001 < 0.005 이 되어 즉시 발동되는 버그 방지.
    if (distKm >= intervalKm && distKm % intervalKm < 0.005) {
      triggerBoxBox();
      boxBoxTriggerCountRef.current += 1;
    }
  }

  function checkLapMilestones() {
    const { distKm } = useRunStore.getState();
    const { selectedCircuitId } = useAppStore.getState();
    const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
    const total = circuit.distanceKm;

    if (!finalLapFiredRef.current && distKm >= total - 1 && distKm < total) {
      finalLapFiredRef.current = true;
      onFinalLapRef.current?.();
    }

    if (!finishFiredRef.current && distKm >= total) {
      finishFiredRef.current = true;
      onFinishRef.current?.();
    }
  }
}
