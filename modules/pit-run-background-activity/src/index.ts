import { requireOptionalNativeModule, Platform } from 'expo-modules-core';

interface PitRunBackgroundActivityNative {
  startSession(): Promise<boolean>;
  stopSession(): Promise<void>;
  isSupported(): boolean;
  isActive(): boolean;
}

const MODULE_NAME = 'PitRunBackgroundActivity';

function getNativeModule(): PitRunBackgroundActivityNative | null {
  if (Platform.OS !== 'ios') return null;
  return requireOptionalNativeModule<PitRunBackgroundActivityNative>(MODULE_NAME);
}

export function isBackgroundActivitySupported(): boolean {
  const mod = getNativeModule();
  if (!mod) return false;
  return mod.isSupported();
}

export function isBackgroundActivityActive(): boolean {
  const mod = getNativeModule();
  if (!mod) return false;
  return mod.isActive();
}

export async function startBackgroundActivitySession(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;
  try {
    return await mod.startSession();
  } catch (e) {
    console.warn('[PitRunBG] startSession threw:', String(e));
    return false;
  }
}

export async function stopBackgroundActivitySession(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    await mod.stopSession();
  } catch (e) {
    console.warn('[PitRunBG] stopSession threw:', String(e));
  }
}
