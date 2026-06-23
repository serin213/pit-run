import {
  addEventListener,
  addSnapshotListener,
  getSnapshot,
  isSupported,
  pauseRace,
  resumeRace,
  startRace,
  stopRace,
  type RunEngineConfig,
  type RunEngineEvent,
  type RunEngineLapEntry,
  type RunEngineSnapshot,
} from 'pit-run-run-engine';

export type {
  RunEngineConfig,
  RunEngineEvent,
  RunEngineLapEntry,
  RunEngineSnapshot,
};

export function isRunEngineSupported(): boolean {
  return isSupported();
}

export async function startRunEngine(config: RunEngineConfig): Promise<RunEngineSnapshot | null> {
  return startRace(config);
}

export async function pauseRunEngine(): Promise<RunEngineSnapshot | null> {
  return pauseRace();
}

export async function resumeRunEngine(): Promise<RunEngineSnapshot | null> {
  return resumeRace();
}

export async function stopRunEngine(): Promise<RunEngineSnapshot | null> {
  return stopRace();
}

export async function getRunEngineSnapshot(): Promise<RunEngineSnapshot | null> {
  return getSnapshot();
}

export function addRunEngineSnapshotListener(
  listener: (snapshot: RunEngineSnapshot) => void,
) {
  return addSnapshotListener(listener);
}

export function addRunEngineEventListener(
  listener: (event: RunEngineEvent) => void,
) {
  return addEventListener(listener);
}
