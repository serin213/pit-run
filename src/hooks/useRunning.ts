import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRunStore } from '../store/runStore';
import { useAppStore } from '../store/appStore';
import { TIRES, PACE_RECORD_INTERVAL_KM } from '../constants/tires';
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
  clearActiveRacePlan,
} from '../api/racePlan';
import {
  getLiveActivityPushRuntimeConfig,
  type LiveActivityPushRuntimeConfig,
} from '../api/liveActivityPush';
import {
  getRaceLapLog,
  setRaceLapLog,
  clearRaceLapLog,
} from '../api/raceLapLog';
import {
  addRunEngineEventListener,
  addRunEngineSnapshotListener,
  isRunEngineSupported,
  pauseRunEngine,
  resumeRunEngine,
  startRunEngine,
  stopRunEngine,
  type RunEngineConfig,
  type RunEngineEvent,
  type RunEngineSnapshot,
} from '../platform/runEngine';
import {
  clearBackgroundCoords,
  stopBackgroundLocationTask,
} from '../platform/locationTask';
import { cancelAllIntervalNotifications } from '../platform/notifications';
import { gpsDiag, laDiag } from '../platform/gpsDiag';
import type { LapEntry } from '../types/run';
import {
  requestBackgroundPermission,
  requestForegroundPermission,
} from '../platform/location';
import {
  isBackgroundActivitySupported,
  startBackgroundActivitySession,
  stopBackgroundActivitySession,
} from '../platform/backgroundActivity';
import { debugGpsConfig } from '../platform/debugGpsConfig';

const ALERT_PHASES = new Set(['boxbox', 'fullPush']);
const FALLBACK_MAX_REPS = 1_000_000;

// Re-export pure helpers for single-import convenience.
export { calcWorkKm, shouldTriggerBoxBox, shouldFireFinalLap, shouldFireFinalLapSafety };

interface UseRunningOptions {
  /** Fired once when the runner enters the final lap. */
  onFinalLap?: () => void;
  /** Fired once when the runner reaches the full circuit distance. */
  onFinish?: () => void;
}

/**
 * Race runtime coordinator.
 *
 * iOS production path:
 *   Native RunEngine owns CoreLocation, pause/resume, interval events, audio
 *   cues, lap log, and native Live Activity snapshot posting.
 *
 * JS path:
 *   Consume native snapshots, sync Zustand/MMKV/result state, and push
 *   foreground Live Activity updates while the app screen is open.
 *
 * Fallback path:
 *   If the native module is unavailable (Android/dev shell), keep the old
 *   store tick/GPS flow alive without using it as the iOS race source.
 */
export function useRunning(options: UseRunningOptions = {}) {
  const { isRunning, isPaused, tick } = useRunStore();
  const nativeEngineSupported = isRunEngineSupported();

  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activityIdRef = useRef<string | null>(null);
  const wasRunningRef = useRef(false);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedNativeRaceIdRef = useRef<string | null>(null);
  const finalLapFiredRef = useRef(false);
  const finishFiredRef = useRef(false);

  const onFinalLapRef = useRef(options.onFinalLap);
  const onFinishRef = useRef(options.onFinish);
  onFinalLapRef.current = options.onFinalLap;
  onFinishRef.current = options.onFinish;

  useEffect(() => {
    return () => {
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
        completedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const snapshotSub = addRunEngineSnapshotListener((snapshot) => {
      applyRunEngineSnapshot(snapshot);
      pushForegroundLiveActivity(snapshot);
    });
    const eventSub = addRunEngineEventListener((event) => {
      handleRunEngineEvent(event);
    });

    return () => {
      snapshotSub?.remove();
      eventSub?.remove();
    };
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (!wasRunningRef.current) return;

      wasRunningRef.current = false;
      startedNativeRaceIdRef.current = null;
      void stopRunEngine().catch(() => {});
      void stopBackgroundLocationTask().catch(() => {});
      void stopBackgroundActivitySession().then(() => {
        useRunStore.setState({ gpsEnabled: false });
      }).catch(() => {});
      void cancelAllIntervalNotifications().catch(() => {});

      const phase = useRunStore.getState().pitPhase;
      const id = activityIdRef.current ?? getCurrentActivityId();
      if (!id) return;
      activityIdRef.current = id;
      if (phase === 'completed') {
        const idToEnd = id;
        activityIdRef.current = null;
        completedTimerRef.current = setTimeout(() => {
          endLiveActivity(idToEnd).catch(() => {});
          completedTimerRef.current = null;
        }, 10000);
      } else {
        endLiveActivity(id).catch(() => {});
        activityIdRef.current = null;
      }
      return;
    }

    wasRunningRef.current = true;
    finalLapFiredRef.current = false;
    finishFiredRef.current = false;
    if (completedTimerRef.current) {
      clearTimeout(completedTimerRef.current);
      completedTimerRef.current = null;
    }

    let cancelled = false;
    (async () => {
      const raceId = useRunStore.getState().raceId;
      if (startedNativeRaceIdRef.current === raceId) return;

      await cancelAllIntervalNotifications().catch(() => {});
      await stopBackgroundLocationTask().catch(() => {});
      clearBackgroundCoords();
      clearRaceLapLog();
      await prepareNativeRunEngineRuntime();

      const liveActivityId = await ensureLiveActivity();
      if (cancelled) return;

      const liveActivityPush = await getLiveActivityPushRuntimeConfig().catch(() => null);
      const config = buildRunEngineConfig(liveActivityId, liveActivityPush);
      seedActiveRacePlan(config);

      if (!nativeEngineSupported) {
        startedNativeRaceIdRef.current = raceId;
        return;
      }

      startedNativeRaceIdRef.current = raceId;
      const snapshot = await startRunEngine(config);
      if (!cancelled && snapshot) {
        applyRunEngineSnapshot(snapshot);
        pushForegroundLiveActivity(snapshot);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isRunning, nativeEngineSupported]);

  useEffect(() => {
    if (!isRunning || !nativeEngineSupported || !startedNativeRaceIdRef.current) return;
    if (isPaused) {
      void pauseRunEngine().then((snapshot) => {
        if (snapshot) applyRunEngineSnapshot(snapshot);
      }).catch(() => {});
      void stopBackgroundActivitySession().then(() => {
        useRunStore.setState({ gpsEnabled: false });
      }).catch(() => {});
      void cancelAllIntervalNotifications().catch(() => {});
    } else {
      void prepareNativeRunEngineRuntime().then(() => resumeRunEngine()).then((snapshot) => {
        if (snapshot) applyRunEngineSnapshot(snapshot);
      }).catch(() => {});
    }
  }, [isRunning, isPaused, nativeEngineSupported]);

  // Fallback only: used when the native iOS run engine is unavailable.
  useEffect(() => {
    if (!isRunning || nativeEngineSupported) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }

    const loop = (ts: number) => {
      if (!isPaused && lastTsRef.current !== null) {
        tick(ts - lastTsRef.current);
        checkFallbackFinish();
      }
      lastTsRef.current = isPaused ? null : ts;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [isRunning, isPaused, nativeEngineSupported, tick]);

  async function ensureLiveActivity(): Promise<string | null> {
    if (!isLiveActivitySupported()) return null;
    setLiveActivityRaceId(useRunStore.getState().raceId);
    const existing = getCurrentActivityId();
    if (existing) {
      activityIdRef.current = existing;
      return existing;
    }
    const { profile, selectedCircuitId } = useAppStore.getState();
    const id = await startLiveActivity(
      profile.displayName,
      profile.nameTagAccentColor,
      selectedCircuitId ?? 'shanghai',
      'race',
    ).catch(() => null);
    activityIdRef.current = id;
    return id;
  }

  async function prepareNativeRunEngineRuntime(): Promise<void> {
    if (!nativeEngineSupported) return;

    const foregroundGranted = await requestForegroundPermission().catch(() => false);
    gpsDiag.fgPerm = foregroundGranted;
    useRunStore.setState({ gpsEnabled: foregroundGranted });
    if (!foregroundGranted) return;

    await requestBackgroundPermission()
      .then((granted) => {
        // gpsDiag mirrors the existing useGPS diagnostics panel.
        gpsDiag.bgPerm = granted;
      })
      .catch(() => {
        gpsDiag.bgPerm = false;
      });

    if (isBackgroundActivitySupported() && debugGpsConfig.useBgSession) {
      const active = await startBackgroundActivitySession().catch(() => false);
      gpsDiag.bgSessionActive = active;
    }
  }

  function buildRunEngineConfig(
    activityId: string | null,
    liveActivityPush: LiveActivityPushRuntimeConfig | null,
  ): RunEngineConfig {
    const run = useRunStore.getState();
    const app = useAppStore.getState();
    const circuit = CIRCUITS.find((c) => c.id === app.selectedCircuitId) ?? CIRCUITS[0];
    const runtimeTire = app.selectedTire ?? run.tire;
    const intervalKm = app.activePlan
      ? app.activePlan.intervals.distanceM / 1000
      : TIRES[runtimeTire].boxBoxDistKm;
    const recoveryDurationMs = app.activePlan
      ? app.activePlan.recovery.durationSec * 1000
      : 60_000;
    const maxReps = app.activePlan
      ? Math.max(1, app.activePlan.intervals.reps)
      : FALLBACK_MAX_REPS;
    const expectedCycleM = app.activePlan?.totals.expectedCycleDistanceM
      ?? Math.round(intervalKm * 1500);
    const basePaceSecPerKm = app.activePlan
      ? app.activePlan.intervals.hardPace
      : (app.qualifyingResult?.paceSecPerKm ?? 360);
    const predictedWorkMs = Math.max(10_000, Math.round(intervalKm * basePaceSecPerKm * 1000));
    const startedAtMs = run.raceStartedAt ? new Date(run.raceStartedAt).getTime() : Date.now();

    return {
      raceId: run.raceId,
      activityId,
      intervalKm,
      recoveryDurationMs,
      maxReps,
      circuitKm: circuit.distanceKm,
      expectedCycleM,
      tire: runtimeTire,
      startedAtMs,
      initialDistKm: run.distKm,
      initialElapsedMs: run.elapsedMs,
      triggerMode: 'distance',
      predictedWorkMs,
      liveActivityPush,
    };
  }

  function seedActiveRacePlan(config: RunEngineConfig): void {
    const now = Date.now();
    setActiveRacePlan({
      mode: 'race',
      runtime: nativeEngineSupported ? 'native' : 'task',
      isRunning: true,
      isPaused: false,
      startedAtMs: config.startedAtMs,
      intervalKm: config.intervalKm,
      recoveryDurationMs: config.recoveryDurationMs,
      maxReps: config.maxReps,
      lastBoxBoxAtKm: config.initialDistKm ?? 0,
      completedReps: 0,
      nextFullPushAtMs: null,
      nextBoxBoxAtMs: null,
      predictedWorkMs: config.predictedWorkMs ?? 0,
      lastFiredAt: null,
      lastFiredAtMs: null,
      workStartedAtMs: now,
      workStartedAtKm: config.initialDistKm ?? 0,
      pitStartedAtMs: null,
      pitStartedAtKm: null,
      circuitKm: config.circuitKm,
      expectedCycleM: config.expectedCycleM,
      finalLapFired: false,
      finishFired: false,
      pausedAtMs: null,
    });
  }

  function handleRunEngineEvent(event: RunEngineEvent): void {
    applyRunEngineSnapshot(event.snapshot, {
      showAlert: event.kind === 'boxbox' || event.kind === 'fullPush',
    });
    pushForegroundLiveActivity(event.snapshot);

    if (event.kind === 'finalLap' && !finalLapFiredRef.current) {
      finalLapFiredRef.current = true;
      useRunStore.setState({ isFinalLap: true });
      onFinalLapRef.current?.();
      return;
    }

    if (event.kind === 'finish' && !finishFiredRef.current) {
      finishFiredRef.current = true;
      onFinishRef.current?.();
    }
  }

  function applyRunEngineSnapshot(
    snapshot: RunEngineSnapshot,
    options: { showAlert?: boolean } = {},
  ): void {
    const lapLog = normalizeLapLog(snapshot.lapLog);
    const state = useRunStore.getState();
    const pitPhase = snapshot.isPaused ? 'none' : snapshot.pitPhase;
    const showAlert = !!options.showAlert
      && AppState.currentState === 'active'
      && !snapshot.isPaused
      && ALERT_PHASES.has(pitPhase);

    const patch: Record<string, unknown> = {
      isRunning: snapshot.isRunning,
      isPaused: snapshot.isPaused,
      distKm: snapshot.distKm,
      elapsedMs: snapshot.elapsedMs,
      paceS: snapshot.paceS > 0 ? snapshot.paceS : state.paceS,
      prog: snapshot.prog,
      gpsEnabled: snapshot.isRunning && !snapshot.isPaused,
      pitPhase,
      lapLog,
      isFinalLap: snapshot.finalLapFired || state.isFinalLap,
    };

    if (showAlert) {
      patch.boxBoxActive = true;
    } else if (snapshot.isPaused || !ALERT_PHASES.has(pitPhase)) {
      patch.boxBoxActive = false;
    }

    if (snapshot.distKm - state.lastRecordDist >= PACE_RECORD_INTERVAL_KM && snapshot.paceS > 0) {
      patch.paceHistory = [...state.paceHistory, snapshot.paceS].slice(-20);
      patch.lastRecordDist = snapshot.distKm;
    }

    if (state.tyreLog.length > 0) {
      const tyreLog = [...state.tyreLog];
      tyreLog[tyreLog.length - 1] = {
        ...tyreLog[tyreLog.length - 1],
        endDist: snapshot.distKm,
      };
      patch.tyreLog = tyreLog;
    }

    useRunStore.setState(patch);
    if (!sameLapLog(getRaceLapLog(), lapLog)) {
      setRaceLapLog(lapLog);
    }
    mirrorActiveRacePlan(snapshot);
  }

  function mirrorActiveRacePlan(snapshot: RunEngineSnapshot): void {
    if (!snapshot.isRunning) return;
    setActiveRacePlan({
      mode: 'race',
      runtime: nativeEngineSupported ? 'native' : 'task',
      isRunning: snapshot.isRunning,
      isPaused: snapshot.isPaused,
      startedAtMs: snapshot.startedAtMs,
      intervalKm: snapshot.intervalKm,
      recoveryDurationMs: snapshot.recoveryDurationMs,
      maxReps: snapshot.maxReps,
      lastBoxBoxAtKm: snapshot.lastBoxBoxAtKm,
      completedReps: snapshot.completedReps,
      nextFullPushAtMs: snapshot.nextFullPushAtMs,
      nextBoxBoxAtMs: snapshot.nextBoxBoxAtMs,
      predictedWorkMs: snapshot.predictedWorkMs,
      lastFiredAt: null,
      lastFiredAtMs: null,
      workStartedAtMs: snapshot.workStartedAtMs,
      workStartedAtKm: snapshot.workStartedAtKm,
      pitStartedAtMs: snapshot.pitStartedAtMs,
      pitStartedAtKm: snapshot.pitStartedAtKm,
      circuitKm: snapshot.circuitKm,
      expectedCycleM: snapshot.expectedCycleM,
      finalLapFired: snapshot.finalLapFired,
      finishFired: snapshot.finishFired,
      pausedAtMs: snapshot.pausedAtMs,
    });
  }

  function pushForegroundLiveActivity(snapshot: RunEngineSnapshot): void {
    if (AppState.currentState !== 'active') return;
    const id = activityIdRef.current ?? getCurrentActivityId() ?? snapshot.activityId;
    if (!id) return;
    activityIdRef.current = id;
    updateLiveActivity(id, {
      distKm: snapshot.distKm,
      elapsedMs: Math.round(snapshot.elapsedMs),
      paceS: Math.round(snapshot.paceS),
      sector: 'red',
      tire: normalizeTire(snapshot.tire),
      pitPhase: snapshot.isPaused ? 'none' : snapshot.pitPhase,
      prog: snapshot.prog,
      isPaused: snapshot.isPaused,
      mode: 'race',
    });
    laDiag.fgLaPush++;
    laDiag.lastPushAt = Date.now();
    laDiag.lastPushDistKm = snapshot.distKm;
    laDiag.lastPushWasBg = false;
  }

  function checkFallbackFinish() {
    const { distKm } = useRunStore.getState();
    const { selectedCircuitId } = useAppStore.getState();
    const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
    if (!finishFiredRef.current && distKm >= circuit.distanceKm) {
      finishFiredRef.current = true;
      clearActiveRacePlan();
      clearRaceLapLog();
      onFinishRef.current?.();
    }
  }
}

function normalizeLapLog(entries: RunEngineSnapshot['lapLog']): LapEntry[] {
  return entries.map((entry) => ({
    idx: entry.idx,
    type: entry.type,
    distM: entry.distM,
    durationSec: entry.durationSec,
    paceS: entry.paceS,
  }));
}

function sameLapLog(a: LapEntry[], b: LapEntry[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  return lastA.idx === lastB.idx
    && lastA.type === lastB.type
    && lastA.distM === lastB.distM
    && Math.round(lastA.durationSec * 10) === Math.round(lastB.durationSec * 10)
    && lastA.paceS === lastB.paceS;
}

function normalizeTire(tire: string): 'soft' | 'medium' | 'hard' | 'wet' {
  if (tire === 'soft' || tire === 'hard' || tire === 'wet') return tire;
  return 'medium';
}
