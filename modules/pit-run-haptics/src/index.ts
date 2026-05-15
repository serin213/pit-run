import { requireOptionalNativeModule } from 'expo-modules-core';

interface PitRunHapticsNative {
  isSupported(): boolean;
  singleImpact(): Promise<void>;
  doubleImpact(): Promise<void>;
  successLong(): Promise<void>;
}

const PitRunHaptics =
  requireOptionalNativeModule<PitRunHapticsNative>('PitRunHaptics') ?? null;

export default PitRunHaptics;
