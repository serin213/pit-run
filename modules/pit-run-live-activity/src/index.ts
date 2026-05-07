import { requireNativeModule, Platform } from 'expo-modules-core';

interface PitRunLiveActivityNative {
  startActivity(driverName: string, teamColor: string, circuitId: string): Promise<string | null>;
  updateActivity(
    activityId: string,
    distKm: number,
    elapsedMs: number,
    paceS: number,
    sector: string,
    tire: string,
    pitPhase: string,
    prog: number,
    isPaused: boolean
  ): Promise<void>;
  endActivity(activityId: string): Promise<void>;
  endAllActivities(): Promise<void>;
  isSupported(): boolean;
}

// On Android or older iOS, return a no-op module so callers don't need to guard
const noop: PitRunLiveActivityNative = {
  startActivity: async () => null,
  updateActivity: async () => {},
  endActivity: async () => {},
  endAllActivities: async () => {},
  isSupported: () => false,
};

const Native: PitRunLiveActivityNative =
  Platform.OS === 'ios'
    ? requireNativeModule<PitRunLiveActivityNative>('PitRunLiveActivity')
    : noop;

export const {
  startActivity,
  updateActivity,
  endActivity,
  endAllActivities,
  isSupported,
} = Native;
