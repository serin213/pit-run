import { requireOptionalNativeModule, Platform } from 'expo-modules-core';

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

// On Android, older iOS, or if native module fails to register, return a no-op
// so callers don't need to guard. Using `requireOptionalNativeModule` (vs the
// throwing `requireNativeModule`) prevents the entire JS bundle from dying when
// the native module isn't ready at module-load time (e.g., New Architecture
// race conditions where TurboModules haven't initialized yet).
const noop: PitRunLiveActivityNative = {
  startActivity: async () => null,
  updateActivity: async () => {},
  endActivity: async () => {},
  endAllActivities: async () => {},
  isSupported: () => false,
};

const nativeModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<PitRunLiveActivityNative>('PitRunLiveActivity')
    : null;

const Native: PitRunLiveActivityNative = nativeModule ?? noop;

export const {
  startActivity,
  updateActivity,
  endActivity,
  endAllActivities,
  isSupported,
} = Native;
