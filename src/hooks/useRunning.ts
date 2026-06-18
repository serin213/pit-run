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
  setLiveActivityRaceId,
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
// background fireLAUpdate가 30초 cadence로 단일 source 담당.
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
  // LA end는 "레이스가 멈췄을 때(true→false 전이)"만 해야 한다. 마운트 시 isRunning이
  // 단순히 false인 경우(카운트다운 직후 RunningScreen 진입, startRun 전)엔 end 금지 —
  // 안 그러면 카운트다운에서 띄운 LA를 본 시작 직전에 죽인다.
  const wasRunningRef = useRef(false);
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
      wasRunningRef.current = true;
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
        completedTimerRef.current = null;
      }
      if (!isLiveActivitySupported()) {
        if (__DEV__) console.warn('[useRunning] LA not supported — skipping start');
        return;
      }
      // APNs push 토큰을 이 레이스에 연결 — 토큰 도착 시 서버 등록에 race_id가 실린다.
      setLiveActivityRaceId(useRunStore.getState().raceId);
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
      // 한 번도 running이 아니었으면(마운트 직후 카운트다운 LA 보존 단계) end 금지.
      if (!wasRunningRef.current) return;
      wasRunningRef.current = false;
      const phase = useRunStore.getState().pitPhase;
      const id = activityIdRef.current ?? getCurrentActivityId();
      if (id) {
        activityIdRef.current = id;
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

  // isRunning true 전환 시 background plan을 1회만 준비한다.
  // pause/resume은 isRunning을 바꾸지 않으므로 여기서 plan을 지우거나 다시 만들면 안 된다.
  useEffect(() => {
    if (!isRunning) return;

    // 레이스 시작 시 per-run ref 초기화
    finalLapFiredRef.current = false;
    finishFiredRef.current = false;

    // Background plan 저장 — locationTask callback이 이걸 single source로 사용.
    // 앱 cold-start 복구로 이미 active race plan이 있으면 덮어쓰지 않는다.
    const existingRacePlan = getActiveRacePlan();
    const isResumingBackgroundRace = !!existingRacePlan?.isRunning;
    const { activePlan } = useAppStore.getState();
    const selectedCircuitId = useAppStore.getState().selectedCircuitId;
    const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
    const initialTire = useRunStore.getState().tire;
    const intervalKmInit = activePlan
      ? activePlan.intervals.distanceM / 1000
      : isResumingBackgroundRace
        ? existingRacePlan.intervalKm
      : TIRES[initialTire].boxBoxDistKm;
    const recoveryDurationMsInit = activePlan
      ? activePlan.recovery.durationSec * 1000
      : isResumingBackgroundRace
        ? existingRacePlan.recoveryDurationMs
        : 60 * 1000;
    const maxRepsInit = activePlan
      ? activePlan.intervals.reps
      : isResumingBackgroundRace
        ? existingRacePlan.maxReps
        : Number.MAX_SAFE_INTEGER;
    const expectedCycleMInit = activePlan?.totals.expectedCycleDistanceM
      ?? Math.round(intervalKmInit * 1500);
    const nowMs = Date.now();
    console.warn('[RaceStart] setActiveRacePlan:', JSON.stringify({
      intervalKm: intervalKmInit,
      lastBoxBoxAtKm: isResumingBackgroundRace ? existingRacePlan.lastBoxBoxAtKm : 0,
      maxReps: maxRepsInit,
      recoveryDurationMs: recoveryDurationMsInit,
      mode: 'race',
      resume: isResumingBackgroundRace,
    }));
    if (!isResumingBackgroundRace) {
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
        circuitKm: circuit.distanceKm,
        expectedCycleM: expectedCycleMInit,
        finalLapFired: false,
        finishFired: false,
        pausedAtMs: null,
      });
    }
  }, [isRunning]);

  // RAF 루프 — 묶음 2 이후엔 elapsedMs 누적용으로만 사용한다.
  // trigger 판정 / plan 업데이트 / lap log / LA push는 background task가 담당.
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
        // 묶음 2: checkBoxBox 호출 폐기 — trigger는 background single source.
        checkFinish();
        // FIX 6-4: foreground RAF의 LA push 제거. LA는 background fireLAUpdate가 단일
        // source. 두 source(background ACCUM + foreground store.distKm)에서 LA push 시
        // timing 차이로 stale 가능. background fireLAUpdate가 일정 cadence로 push.
        // foreground RAF는 store/UI 갱신만 담당.
      }
      if (isPaused) lastTsRef.current = null;
      else lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [isRunning, isPaused, tick]);

  // 묶음 2: plan polling — background가 갱신한 plan/lapLog를 foreground store에 sync.
  // 1초 interval + AppState 'active' 즉시 sync.
  useEffect(() => {
    if (!isRunning) return;

    // FIX 15-2: AppState 'active' 전환 직후 첫 syncFromPlan에서는 boxBoxActive를
    // 새로 켜지 않음. 잠금 중 발생한 박스박스/풀푸시는 복귀 시점엔 이미 지난 이벤트라
    // 시트를 "몰아서" 띄우면 안 됨 — pitPhase 자체(inPit 등)는 정상 반영.
    const suppressBoxBoxOnceRef = { current: false };

    const syncFromPlan = () => {
      const plan = getActiveRacePlan();
      if (!plan || plan.mode !== 'race') return;

      const derivedPhase = derivePitPhaseFromPlan(plan);
      const lapLog = getRaceLapLog();
      const state = useRunStore.getState();
      const suppressBoxBox = suppressBoxBoxOnceRef.current;
      suppressBoxBoxOnceRef.current = false;

      const patch: Partial<{
        pitPhase: 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';
        boxBoxActive: boolean;
        lapLog: typeof state.lapLog;
      }> = {};

      if (plan.isPaused || state.isPaused) {
        if (state.pitPhase !== 'none') patch.pitPhase = 'none';
        if (state.boxBoxActive) patch.boxBoxActive = false;
        if (lapLog.length !== state.lapLog.length) patch.lapLog = lapLog;
        if (Object.keys(patch).length > 0) {
          useRunStore.setState(patch);
        }
        return;
      }

      if (state.pitPhase !== derivedPhase && state.pitPhase !== 'completed') {
        patch.pitPhase = derivedPhase;
        // 외출② 보완: alert phase ('boxbox', 'fullPush') 4초 윈도우에만 BoxBoxSheet 표시.
        // 회복 시간(180초) 동안 inPit phase는 트랙 + IN PIT 헤더로 별도 표시.
        // 기존 'derivedPhase !== none'은 inPit에서도 true → 회복 내내 바텀싯 안 닫힘.
        patch.boxBoxActive = (derivedPhase === 'boxbox' || derivedPhase === 'fullPush') && !suppressBoxBox;
      }
      // lapLog는 background이 길이만 늘림. 길이 비교로만 sync.
      if (lapLog.length !== state.lapLog.length) {
        patch.lapLog = lapLog;
      }

      if (Object.keys(patch).length > 0) {
        useRunStore.setState(patch);
      }

      // final lap 판정 — 회복 종료 시점에 1회 (background가 fullPush 발화 후).
      if (plan.finalLapFired && !finalLapFiredRef.current) {
        finalLapFiredRef.current = true;
        useRunStore.setState({ isFinalLap: true });
      } else if (!finalLapFiredRef.current && plan.nextFullPushAtMs == null) {
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

      if (plan.finishFired && !finishFiredRef.current) {
        finishFiredRef.current = true;
        onFinishRef.current?.();
      }
    };

    syncFromPlan();
    const intervalId = setInterval(syncFromPlan, PLAN_POLL_INTERVAL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        suppressBoxBoxOnceRef.current = true;
        syncFromPlan();
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [isRunning]);

  // pitPhase/isPaused 변화 → 즉시 LA update (alert UI 시각 반영).
  // FIX 15-1A: deps에 isPaused가 있어 pause/resume 전환 시 정확히 1회 push됨 —
  // pause 진입 시 isPaused:true로 멈춤 상태 고정, resume 시 isPaused:false로 재개.
  // distKm/elapsedMs는 1-B(거리 누적 정지) + RAF isPaused 가드로 pause 중 동결되므로
  // 이 push 사이 추가 갱신이 없어도 LA가 정지 상태를 그대로 유지.
  const pitPhase = useRunStore((s) => s.pitPhase);
  useEffect(() => {
    const id = activityIdRef.current ?? getCurrentActivityId();
    if (!id) return;
    activityIdRef.current = id;
    const { distKm, elapsedMs, paceS, tire, prog } = useRunStore.getState();
    const state = {
      distKm,
      elapsedMs: Math.round(elapsedMs),
      paceS: Math.round(paceS),
      sector: 'red',
      tire,
      pitPhase,
      prog,
      isPaused,
      mode: 'race',
    } as const;
    updateLiveActivity(id, state);
    if (isPaused) {
      const retry = setTimeout(() => {
        updateLiveActivity(id, state);
      }, 1000);
      return () => clearTimeout(retry);
    }
    return undefined;
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
