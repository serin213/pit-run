import { beforeEach, describe, expect, it, vi } from 'vitest';

const memoryStorage = new Map<string, string | boolean>();

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => {
      const value = memoryStorage.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getBoolean: (key: string) => {
      const value = memoryStorage.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    set: (key: string, value: string | boolean) => {
      memoryStorage.set(key, value);
    },
    remove: (key: string) => {
      memoryStorage.delete(key);
    },
    clearAll: () => {
      memoryStorage.clear();
    },
  }),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'background',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Platform: { OS: 'ios' },
}));

vi.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  LocationActivityType: { Fitness: 'Fitness', Other: 'Other' },
  hasStartedLocationUpdatesAsync: vi.fn(async () => false),
  startLocationUpdatesAsync: vi.fn(async () => undefined),
  stopLocationUpdatesAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-task-manager', () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(async () => true),
  getRegisteredTasksAsync: vi.fn(async () => []),
}));

vi.mock('../platform/audio', () => ({
  playSound: vi.fn(async () => undefined),
}));

vi.mock('../platform/liveActivity', () => ({
  getCurrentActivityId: vi.fn(() => 'activity-1'),
  updateLiveActivity: vi.fn(async () => undefined),
}));

vi.mock('../store/appStore', () => ({
  useAppStore: {
    getState: () => ({
      selectedCircuitId: 'test-circuit',
      activePlan: {
        totals: { expectedCycleDistanceM: 600 },
      },
    }),
  },
}));

vi.mock('../config/circuits', () => ({
  DEFAULT_CIRCUIT_KM: 1,
  CIRCUITS: [
    {
      id: 'test-circuit',
      displayName: 'Test',
      distanceKm: 5,
      baseIntervalM: 400,
      baseReps: 2,
    },
  ],
}));

import { playSound } from '../platform/audio';
import { updateLiveActivity } from '../platform/liveActivity';
import { clearActiveRacePlan, getActiveRacePlan, setActiveRacePlan } from '../api/racePlan';
import { clearRaceLapLog, getRaceLapLog } from '../api/raceLapLog';
import {
  __simulateBackgroundRaceEventsForTest,
  clearBackgroundCoords,
  setAccumulatedKm,
} from '../platform/locationTask';
import { useRunStore } from '../store/runStore';

function setRacePlan(overrides: Partial<NonNullable<ReturnType<typeof getActiveRacePlan>>> = {}) {
  const now = Date.now();
  setActiveRacePlan({
    mode: 'race',
    isRunning: true,
    isPaused: false,
    startedAtMs: now - 60_000,
    intervalKm: 0.4,
    recoveryDurationMs: 180_000,
    maxReps: 2,
    lastBoxBoxAtKm: 0,
    completedReps: 0,
    nextFullPushAtMs: null,
    lastFiredAt: null,
    lastFiredAtMs: null,
    workStartedAtMs: now - 60_000,
    workStartedAtKm: 0,
    pitStartedAtMs: null,
    pitStartedAtKm: null,
    circuitKm: 5,
    expectedCycleM: 600,
    finalLapFired: false,
    finishFired: false,
    pausedAtMs: null,
    ...overrides,
  });
}

describe('race pause lifecycle simulation', () => {
  beforeEach(() => {
    memoryStorage.clear();
    clearActiveRacePlan();
    clearRaceLapLog();
    clearBackgroundCoords();
    useRunStore.setState({
      isRunning: true,
      isPaused: false,
      distKm: 0,
      elapsedMs: 0,
      boxBoxActive: false,
      pitPhase: 'none',
      gpsEnabled: true,
    });
    vi.clearAllMocks();
  });

  it('does not commit boxbox when paused even if accumulated distance already passed interval', async () => {
    setRacePlan({ isPaused: true, pausedAtMs: Date.now(), lastFiredAt: null, lastFiredAtMs: null });
    setAccumulatedKm(0.45);

    await __simulateBackgroundRaceEventsForTest();

    expect(playSound).not.toHaveBeenCalled();
    expect(updateLiveActivity).not.toHaveBeenCalled();
    expect(getRaceLapLog()).toHaveLength(0);
    expect(getActiveRacePlan()?.completedReps).toBe(0);
    expect(getActiveRacePlan()?.lastFiredAt).toBeNull();
  });

  it('does not commit fullPush when paused even if recovery timer already elapsed', async () => {
    setRacePlan({
      isPaused: true,
      pausedAtMs: Date.now(),
      completedReps: 1,
      lastBoxBoxAtKm: 0.4,
      nextFullPushAtMs: Date.now() - 1000,
      pitStartedAtMs: Date.now() - 181_000,
      pitStartedAtKm: 0.4,
    });
    setAccumulatedKm(0.5);

    await __simulateBackgroundRaceEventsForTest();

    expect(playSound).not.toHaveBeenCalled();
    expect(updateLiveActivity).not.toHaveBeenCalled();
    expect(getRaceLapLog()).toHaveLength(0);
    expect(getActiveRacePlan()?.nextFullPushAtMs).not.toBeNull();
  });

  it('commits boxbox while running and then pause clears marker and sheet state', async () => {
    setRacePlan();
    setAccumulatedKm(0.45);

    await __simulateBackgroundRaceEventsForTest();

    expect(playSound).toHaveBeenCalledWith('boxbox');
    expect(updateLiveActivity).toHaveBeenCalledTimes(1);
    expect(getRaceLapLog()).toHaveLength(1);
    expect(getActiveRacePlan()?.completedReps).toBe(1);
    expect(getActiveRacePlan()?.lastFiredAt).toBe('boxbox');

    useRunStore.setState({ boxBoxActive: true, pitPhase: 'boxbox' });
    useRunStore.getState().pauseRun();

    expect(getActiveRacePlan()?.isPaused).toBe(true);
    expect(getActiveRacePlan()?.lastFiredAt).toBeNull();
    expect(getActiveRacePlan()?.lastFiredAtMs).toBeNull();
    expect(useRunStore.getState().boxBoxActive).toBe(false);
    expect(useRunStore.getState().pitPhase).toBe('none');
    expect(useRunStore.getState().gpsEnabled).toBe(false);
  });
});
