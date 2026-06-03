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
import {
  calcWorkKm,
  shouldTriggerBoxBox,
  shouldFireFinalLap,
  shouldFireFinalLapSafety,
} from '../lib/runTriggers';

// Live Activity는 초당 1회로 throttle (ActivityKit 권고)
const LA_UPDATE_INTERVAL_MS = 1000;

// Re-export pure helpers for single-import convenience
export { calcWorkKm, shouldTriggerBoxBox, shouldFireFinalLap, shouldFireFinalLapSafety };

interface UseRunningOptions {
  /** Fired once when the runner enters the final lap. */
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

  // [A] Work distance tracking refs
  const workStartKmRef = useRef(0);
  const prevPitPhaseRef = useRef<string>('none');

  // [B] Lap logging refs
  const lapStartKmRef = useRef(0);
  const lapStartMsRef = useRef(0);
  const pitStartKmRef = useRef(0);
  const pitStartMsRef = useRef(0);
  const lapIdxRef = useRef(0);

  // Always-fresh callback refs so the RAF closure picks up the latest handlers.
  const onFinalLapRef = useRef(options.onFinalLap);
  const onFinishRef = useRef(options.onFinish);
  onFinalLapRef.current = options.onFinalLap;
  onFinishRef.current = options.onFinish;

  // isRunning 변화 → Live Activity 시작/종료
  // 자연 완주(pitPhase === 'completed')일 때는 종료를 ResultScreen 마운트로 위임 →
  // "Well done, mate" 상태가 잠금화면에 잠시 유지되도록.
  useEffect(() => {
    // cleanup: 훅 unmount 시 pending 타이머 정리
    // (컴포넌트 unmount 후 타이머가 발화해 잘못된 LA를 끊는 방지)
    return () => {
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
        completedTimerRef.current = null;
      }
    };
  }, []);

  // ── Background resume catch-up — distKm 큰 jump 감지 후 work 사이클 reset.
  //
  // 시나리오:
  //   1. JS suspended (화면 잠금/앱 백그라운드) — RAF/setInterval 정지
  //   2. background location task는 OS 콜백으로 계속 누적 거리 MMKV에 기록
  //   3. 앱 active 복귀 → useGPS의 AppState listener가 drainAccum 호출 →
  //      누적된 큰 delta를 addGpsDistance에 한 번에 전달
  //   4. distKm 큰 폭 jump → checkBoxBox가 workKm >= intervalKm 즉시 만족 →
  //      boxbox 트리거 → 4s 후 inPit → 회복시간 후 fullPush. 사용자 입장에선
  //      "박스박스 뜨고 곧 풀푸시" 사이클이 자동 시작되는 게 부자연스러움
  //      (실제로 인터벌 한 번 안 뛰었는데 알림만 깜빡)
  //
  // Fix: delta > 50m (1초 polling 인간 최대 ~5m, 정상 범위 훌쩍 초과) = catch-up
  // 으로 간주 → workStartKmRef / lapStartKmRef / pitStartKmRef 를 현재 distKm
  // 으로 reset. 다음 boxbox는 새로 intervalKm 채워야 발화 → 사용자가 알림 받지
  // 못한 background 시간 동안의 stale 트리거 모두 무효화.
  //
  // Zustand subscribe로 store 변경 직후 동기 실행 — 다음 RAF의 checkBoxBox보다
  // 무조건 먼저 발화 보장.
  useEffect(() => {
    const unsub = useRunStore.subscribe((state, prevState) => {
      if (!state.isRunning || state.isPaused) return;
      const delta = state.distKm - prevState.distKm;
      if (delta <= 0.05) return; // 정상 1초 polling 범위
      workStartKmRef.current = state.distKm;
      lapStartKmRef.current = state.distKm;
      lapStartMsRef.current = state.elapsedMs;
      pitStartKmRef.current = state.distKm;
      pitStartMsRef.current = state.elapsedMs;
      if (__DEV__) {
        console.warn(
          `[useRunning] background catch-up: distKm jumped ${delta.toFixed(3)}km, ` +
          `resetting work/lap/pit refs to current ${state.distKm.toFixed(3)}km`,
        );
      }
    });
    return () => unsub();
  }, []);

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

    // 레이스 시작 시 모든 per-run ref 초기화
    finalLapFiredRef.current = false;
    finishFiredRef.current = false;
    boxBoxTriggerCountRef.current = 0;
    workStartKmRef.current = 0;
    prevPitPhaseRef.current = 'none';
    lapStartKmRef.current = 0;
    lapStartMsRef.current = 0;
    pitStartKmRef.current = 0;
    pitStartMsRef.current = 0;
    lapIdxRef.current = 0;

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
    const {
      distKm, elapsedMs, tire, boxBoxActive, pitPhase: phase,
      triggerBoxBox, pushLap, setFinalLap, isFinalLap,
    } = useRunStore.getState();

    if (boxBoxActive) return;

    const activePlan = useAppStore.getState().activePlan;
    const intervalKm = activePlan
      ? activePlan.intervals.distanceM / 1000
      : TIRES[tire].boxBoxDistKm;
    const maxReps = activePlan ? activePlan.intervals.reps : Infinity;

    // ── Phase transition: 회복 종료 → work 시작 ──────────────────────────────
    if (prevPitPhaseRef.current !== 'none' && phase === 'none') {
      // [B] pit 구간 기록
      const pitDistM = Math.max(0, Math.round((distKm - pitStartKmRef.current) * 1000));
      const pitDurationSec = Math.max(0.1, (elapsedMs - pitStartMsRef.current) / 1000);
      pushLap({
        idx: lapIdxRef.current++,
        type: 'pit',
        distM: pitDistM,
        durationSec: pitDurationSec,
        paceS: null,
      });

      // work 시작점 갱신
      workStartKmRef.current = distKm;
      lapStartKmRef.current = distKm;
      lapStartMsRef.current = elapsedMs;

      // [C] 주판정: 남은 거리가 1사이클 이하 → 최종 랩
      if (!finalLapFiredRef.current) {
        const { selectedCircuitId } = useAppStore.getState();
        const circuit = CIRCUITS.find(c => c.id === selectedCircuitId) ?? CIRCUITS[0];
        const expectedCycleM = activePlan?.totals.expectedCycleDistanceM
          ?? Math.round(intervalKm * 1500); // fallback: interval + ~50% recovery estimate
        if (shouldFireFinalLap({ distKm, circuitKm: circuit.distanceKm, expectedCycleM })) {
          finalLapFiredRef.current = true;
          setFinalLap(true);
          onFinalLapRef.current?.();
        }
      }
    }

    // ── Phase transition: work 종료 → 회복 시작 ──────────────────────────────
    if (prevPitPhaseRef.current === 'none' && phase !== 'none') {
      // [B] pit 시작점 기록
      pitStartKmRef.current = distKm;
      pitStartMsRef.current = elapsedMs;
    }

    prevPitPhaseRef.current = phase;

    // 회복 중에는 BoxBox 트리거 없음
    if (phase !== 'none') return;

    // [C] 안전망: work 중 남은 거리 기준 최종 랩 (주판정을 놓친 경우 대비)
    if (!finalLapFiredRef.current) {
      const { selectedCircuitId } = useAppStore.getState();
      const circuit = CIRCUITS.find(c => c.id === selectedCircuitId) ?? CIRCUITS[0];
      if (shouldFireFinalLapSafety({ distKm, circuitKm: circuit.distanceKm, intervalKm })) {
        finalLapFiredRef.current = true;
        setFinalLap(true);
        onFinalLapRef.current?.();
      }
    }

    // 모든 인터벌 소화 시 BoxBox 트리거 없음 (cool-down)
    if (boxBoxTriggerCountRef.current >= maxReps) return;

    // [A] work 거리 기반 트리거 (기존 modulo 방식 제거)
    const workKm = calcWorkKm(distKm, workStartKmRef.current);
    if (workKm >= intervalKm) {
      // [C] 최종 랩: 회복 스킵 → 바로 완주 처리
      if (isFinalLap) {
        if (!finishFiredRef.current) {
          finishFiredRef.current = true;
          const distM = Math.round(workKm * 1000);
          const durationSec = Math.max(0.1, (elapsedMs - lapStartMsRef.current) / 1000);
          const paceS = durationSec / (distM / 1000);
          pushLap({
            idx: lapIdxRef.current++,
            type: 'lap',
            distM,
            durationSec,
            paceS: isFinite(paceS) ? Math.round(paceS) : null,
          });
          onFinishRef.current?.();
        }
        return;
      }

      // [B] work(lap) 구간 기록
      const distM = Math.round(workKm * 1000);
      const durationSec = Math.max(0.1, (elapsedMs - lapStartMsRef.current) / 1000);
      const paceS = durationSec / (distM / 1000);
      pushLap({
        idx: lapIdxRef.current++,
        type: 'lap',
        distM,
        durationSec,
        paceS: isFinite(paceS) ? Math.round(paceS) : null,
      });

      triggerBoxBox();
      boxBoxTriggerCountRef.current += 1;
    }
  }

  function checkLapMilestones() {
    const { distKm } = useRunStore.getState();
    const { selectedCircuitId } = useAppStore.getState();
    const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
    const total = circuit.distanceKm;

    // 최종 랩 판정은 checkBoxBox의 cycle-based 로직으로 처리.
    // 완주 안전망: 서킷 총 거리 초과 시 finish (GPS 드리프트 등 예외 대비)
    if (!finishFiredRef.current && distKm >= total) {
      finishFiredRef.current = true;
      onFinishRef.current?.();
    }
  }
}
