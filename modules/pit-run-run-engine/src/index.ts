import { requireOptionalNativeModule, Platform, type EventSubscription } from 'expo-modules-core';

export type RunEnginePitPhase = 'none' | 'boxbox' | 'inPit' | 'fullPush' | 'completed';
export type RunEngineEventKind = 'boxbox' | 'fullPush' | 'finalLap' | 'finish';
export type RunEngineTriggerMode = 'distance' | 'time';

export type RunEngineLapEntry = {
  idx: number;
  type: 'lap' | 'pit';
  distM: number;
  durationSec: number;
  paceS: number | null;
};

export type RunEngineConfig = {
  raceId?: string | null;
  activityId?: string | null;
  intervalKm: number;
  recoveryDurationMs: number;
  maxReps: number;
  circuitKm: number;
  expectedCycleM: number;
  tire: string;
  startedAtMs: number;
  initialDistKm?: number;
  initialElapsedMs?: number;
  triggerMode?: RunEngineTriggerMode;
  predictedWorkMs?: number;
  liveActivityPush?: {
    enabled: true;
    supabaseUrl: string;
    supabaseAnonKey: string;
    accessToken: string;
  } | null;
};

export type RunEngineSnapshot = {
  raceId: string | null;
  activityId: string | null;
  isRunning: boolean;
  isPaused: boolean;
  startedAtMs: number;
  pausedAtMs: number | null;
  distKm: number;
  elapsedMs: number;
  paceS: number;
  prog: number;
  tire: string;
  pitPhase: RunEnginePitPhase;
  completedReps: number;
  intervalKm: number;
  recoveryDurationMs: number;
  maxReps: number;
  circuitKm: number;
  expectedCycleM: number;
  nextFullPushAtMs: number | null;
  nextBoxBoxAtMs: number | null;
  predictedWorkMs: number;
  lastBoxBoxAtKm: number;
  workStartedAtMs: number;
  workStartedAtKm: number;
  pitStartedAtMs: number | null;
  pitStartedAtKm: number | null;
  finalLapFired: boolean;
  finishFired: boolean;
  lapLog: RunEngineLapEntry[];
  mode: 'race';
};

export type RunEngineEvent = {
  kind: RunEngineEventKind;
  firedAtMs: number;
  distKm: number;
  snapshot: RunEngineSnapshot;
};

interface PitRunRunEngineNative {
  addListener(eventName: string, listener: (event: RunEngineSnapshot | RunEngineEvent) => void): EventSubscription;
  isSupported(): boolean;
  startRace(config: RunEngineConfig): Promise<RunEngineSnapshot>;
  pauseRace(): Promise<RunEngineSnapshot>;
  resumeRace(): Promise<RunEngineSnapshot>;
  stopRace(): Promise<RunEngineSnapshot>;
  getSnapshot(): Promise<RunEngineSnapshot | null>;
}

const MODULE_NAME = 'PitRunRunEngine';

function getNativeModule(): PitRunRunEngineNative | null {
  if (Platform.OS !== 'ios') return null;
  return requireOptionalNativeModule<PitRunRunEngineNative>(MODULE_NAME);
}

export function isSupported(): boolean {
  return getNativeModule()?.isSupported() ?? false;
}

export async function startRace(config: RunEngineConfig): Promise<RunEngineSnapshot | null> {
  return getNativeModule()?.startRace(config) ?? null;
}

export async function pauseRace(): Promise<RunEngineSnapshot | null> {
  return getNativeModule()?.pauseRace() ?? null;
}

export async function resumeRace(): Promise<RunEngineSnapshot | null> {
  return getNativeModule()?.resumeRace() ?? null;
}

export async function stopRace(): Promise<RunEngineSnapshot | null> {
  return getNativeModule()?.stopRace() ?? null;
}

export async function getSnapshot(): Promise<RunEngineSnapshot | null> {
  return getNativeModule()?.getSnapshot() ?? null;
}

export function addSnapshotListener(listener: (snapshot: RunEngineSnapshot) => void): EventSubscription | null {
  const mod = getNativeModule();
  if (!mod) return null;
  return mod.addListener('onRunSnapshot', (event) => listener(event as RunEngineSnapshot));
}

export function addEventListener(listener: (event: RunEngineEvent) => void): EventSubscription | null {
  const mod = getNativeModule();
  if (!mod) return null;
  return mod.addListener('onRunEvent', (event) => listener(event as RunEngineEvent));
}
