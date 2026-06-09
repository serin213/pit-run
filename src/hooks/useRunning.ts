import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
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
import {
  setActiveRacePlan,
  getActiveRacePlan,
  clearActiveRacePlan,
} from '../api/racePlan';
import { getRaceLapLog, clearRaceLapLog } from '../api/raceLapLog';
import { stopBackgroundLocationTask } from '../platform/locationTask';

// FIX 6-4: LA_UPDATE_INTERVAL_MS 제거. foreground RAF LA push 폐기 후 미사용.
// background fireLAUpdate가 5초 throttle로 단일 source 담당.
// 묶음 2: alert phase 유지 ms — background가 lastFiredAtMs를 patch하면 이 시간 안에
// foreground polling이 alert phase로 derive. locationTask.ts의 BOXBOX_ALERT_MS와 동일.
const ALERT_MS = 4000;
// 묶음 2: foreground polling 간격. 잠금 해제 직후 AppState 'active'에서도 즉시 sync.
const PLAN_POLL_INTERVAL_MS = 1000;

// Re-export pure helpers for single-import convenience
export { calcWorkKm, shouldTriggerBoxBox, shouldFireFinalLap, shouldFireFinalLapSafety };

interface UseRunningOptions {
  /** Fired once when the runner enters the final lap. */
  onFinalLap?: () => void;
  /** Fired once when the runner reaches the full circuit distance. */
  onFinish?: () => void;
}

/**
 * 묶음 2: background를 single source of truth로 통일.
 * - trigger 발화 / plan 업데이트 / lap log push / LA update 모두 locationTask.ts
 * - foreground useRunning은 plan polling으로 UI만 동기화 (boxBoxActive, pitPhase, lapLog)
 * - RAF tick은 isPaused 가드 + elapsedMs 누적용으로만 잔존 (시뮬레이션 페이스 계산 X)
 */
export function useRunning(options: UseRunningOptions = {}) {
  const { isRunning, isPaused, tick } = useRunStore();

  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activityIdRef = useRef<string | null>(null);
  // FIX 6-4: lastLAUpdateRef 제거 (RAF LA push 폐기 후 미사용).
  const finalLapFiredRef = useRef(false);
  const finishFiredRef = useRef(false);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-fresh callback refs so closures pick up the latest handlers.
  const onFinalLapRef = useRef(options.onFinalLap);
  const onFinishRef = useRef(options.onFinish);
  onFinalLapRef.current = options.onFinalLap;
  onFinishRef.current = options.onFinish;

  // isRunning 변화 → Live Activity 시작/종료
  useEffect(() => {
    return () => {
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
        completedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning) {
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
          const idToEnd = id;
          activityIdRef.current = null;
          completedTimerRef.current = setTimeout(() => {
            endLiveActivity(idToEnd).catch(() => {});
            completedTimerRef.current = null;
          }, 10000);
        } else {
          endLiveActivity(id);
          activityIdRef.current = null;
        }
      }
    }
  }, [isRunning]);

  // RAF 루프 — 묶음 2 이후엔 elapsedMs 누적 + LA throttled update만.
  // trigger 판정 / plan 업데이트 / lap log는 background로 이전.
  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
      return;
    }

    // 레이스 시작 시 per-run ref 초기화
    finalLapFiredRef.current = false;
    finishFiredRef.current = false;

    // Background plan 저장 — locationTask callback이 이걸 single source로 사용.
    const { activePlan } = useAppStore.getState();
    const initialTire = useRunStore.getState().tire;
    const intervalKmInit = activePlan
      ? activePlan.intervals.distanceM / 1000
      : TIRES[initialTire].boxBoxDistKm;
    const recoveryDurationMsInit = (activePlan?.recovery.durationSec ?? 60) * 1000;
    const maxRepsInit = activePlan ? activePlan.intervals.reps : Number.MAX_SAFE_INTEGER;
    const nowMs = Date.now();
    console.warn('[RaceStart] setActiveRacePlan:', JSON.stringify({
      intervalKm: intervalKmInit,
      lastBoxBoxAtKm: 0,
      maxReps: maxRepsInit,
      recoveryDurationMs: recoveryDurationMsInit,
      mode: 'race',
    }));
    // 묶음 2: lap log MMKV도 race 시작 시 reset (이전 race 잔재 차단).
    clearRaceLapLog();
    setActiveRacePlan({
      mode: 'race',
      isRunning: true,
      isPaused: false,
      startedAtMs: nowMs,
      intervalKm: intervalKmInit,
      recoveryDurationMs: recoveryDurationMsInit,
      maxReps: maxRepsInit,
      lastBoxBoxAtKm: 0,
      completedReps: 0,
      nextFullPushAtMs: null,
      lastFiredAt: null,
      lastFiredAtMs: null,
      workStartedAtMs: nowMs,
      workStartedAtKm: 0,
      pitStartedAtMs: null,
      pitStartedAtKm: null,
    });

    const loop = (ts: number) => {
      if (!isPaused && lastTsRef.current !== null) {
        const dt = ts - lastTsRef.current;
        tick(dt);
        // 묶음 2: checkBoxBox 호출 폐기 — trigger는 background single source.
        checkFinish();
        // FIX 6-4: foreground RAF의 LA push 제거. LA는 background fireLAUpdate가 단일
        // source. 두 source(background ACCUM + foreground store.distKm)에서 LA push 시
        // timing 차이로 stale 가능. background fireLAUpdate가 모든 callback에서 5초
        // throttle로 push (외출① 보완 commit 2). foreground RAF는 store/UI 갱신만 담당.
      }
      if (isPaused) lastTsRef.current = null;
      else lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearActiveRacePlan();
      clearRaceLapLog();
    };
  }, [isRunning, isPaused, tick]);

  // 묶음 2: plan polling — background가 갱신한 plan/lapLog를 foreground store에 sync.
  // 1초 interval + AppState 'active' 즉시 sync.
  useEffect(() => {
    if (!isRunning) return;

    const syncFromPlan = () => {
      const plan = getActiveRacePlan();
      if (!plan || plan.mode !== 'race') return;

      const derivedPhase = derivePitPhaseFromPlan(plan);
      const lapLog = getRaceLapLog();
      const state = useRunStore.getState();

      const patch: Partial<{
        pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';
        boxBoxActive: boolean;
        lapLog: typeof state.lapLog;
      }> = {};

      if (state.pitPhase !== derivedPhase && state.pitPhase !== 'completed') {
        patch.pitPhase = derivedPhase;
        // 외출② 보완: alert phase ('boxbox', 'fullPush') 4초 윈도우에만 BoxBoxSheet 표시.
        // 회복 시간(180초) 동안 inPit phase는 트랙 + IN PIT 헤더로 별도 표시.
        // 기존 'derivedPhase !== none'은 inPit에서도 true → 회복 내내 바텀싯 안 닫힘.
        patch.boxBoxActive = derivedPhase === 'boxbox' || derivedPhase === 'fullPush';
      }
      // lapLog는 background이 길이만 늘림. 길이 비교로만 sync.
      if (lapLog.length !== state.lapLog.length) {
        patch.lapLog = lapLog;
      }

      if (Object.keys(patch).length > 0) {
        useRunStore.setState(patch);
      }

      // final lap 판정 — 회복 종료 시점에 1회 (background가 fullPush 발화 후).
      if (!finalLapFiredRef.current && plan.nextFullPushAtMs == null) {
        const { selectedCircuitId, activePlan } = useAppStore.getState();
        const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
        const expectedCycleM = activePlan?.totals.expectedCycleDistanceM
          ?? Math.round(plan.intervalKm * 1500);
        if (shouldFireFinalLap({ distKm: state.distKm, circuitKm: circuit.distanceKm, expectedCycleM })) {
          finalLapFiredRef.current = true;
          useRunStore.setState({ isFinalLap: true });
          onFinalLapRef.current?.();
        } else if (
          shouldFireFinalLapSafety({ distKm: state.distKm, circuitKm: circuit.distanceKm, intervalKm: plan.intervalKm })
        ) {
          finalLapFiredRef.current = true;
          useRunStore.setState({ isFinalLap: true });
          onFinalLapRef.current?.();
        }
      }
    };

    syncFromPlan();
    const intervalId = setInterval(syncFromPlan, PLAN_POLL_INTERVAL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncFromPlan();
    });

    return () => {
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [isRunning]);

  // pitPhase 변화 → 즉시 LA update (alert UI 시각 반영)
  const pitPhase = useRunStore((s) => s.pitPhase);
  useEffect(() => {
    const id = activityIdRef.current;
    if (!id) return;
    const { distKm, elapsedMs, paceS, tire, prog } = useRunStore.getState();
    updateLiveActivity(id, {
      distKm,
      elapsedMs: Math.round(elapsedMs),
      paceS: Math.round(paceS),
      sector: 'red',
      tire,
      pitPhase,
      prog,
      isPaused,
      mode: 'race',
    });
  }, [pitPhase, isPaused]);

  /**
   * 묶음 2: 완주(서킷 총거리 도달) 안전망 — background는 trigger만 발화하고
   * finish는 polling이 distance 기반으로 판정. final lap도 동일.
   */
  function checkFinish() {
    const { distKm } = useRunStore.getState();
    const { selectedCircuitId } = useAppStore.getState();
    const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
    const total = circuit.distanceKm;

    if (!finishFiredRef.current && distKm >= total) {
      finishFiredRef.current = true;
      stopBackgroundLocationTask().catch(() => {});
      clearActiveRacePlan();
      clearRaceLapLog();
      onFinishRef.current?.();
    }
  }
}

/**
 * 묶음 2: plan 기반 pitPhase derive.
 * - lastFiredAt 'boxbox' && 4초 이내 → 'boxbox' (alert 표시)
 * - lastFiredAt 'fullPush' && 4초 이내 → 'fullPush' (alert 표시)
 * - nextFullPushAtMs > now → 'inPit' (회복 중)
 * - 그 외 → 'none' (work)
 */
function derivePitPhaseFromPlan(
  plan: ActiveRacePlanLike,
): 'none' | 'boxbox' | 'inPit' | 'fullPush' {
  const now = Date.now();
  if (plan.lastFiredAt === 'boxbox' && plan.lastFiredAtMs != null && now - plan.lastFiredAtMs < ALERT_MS) {
    return 'boxbox';
  }
  if (plan.lastFiredAt === 'fullPush' && plan.lastFiredAtMs != null && now - plan.lastFiredAtMs < ALERT_MS) {
    return 'fullPush';
  }
  if (plan.nextFullPushAtMs != null && plan.nextFullPushAtMs > now) {
    return 'inPit';
  }
  return 'none';
}

type ActiveRacePlanLike = {
  lastFiredAt: 'boxbox' | 'fullPush' | null;
  lastFiredAtMs: number | null;
  nextFullPushAtMs: number | null;
};
