import { Platform } from 'react-native';
import {
  startBackgroundActivitySession as nativeStart,
  stopBackgroundActivitySession as nativeStop,
  isBackgroundActivitySupported as nativeIsSupported,
  isBackgroundActivityActive as nativeIsActive,
} from 'pit-run-background-activity';

export function isBackgroundActivitySupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  return nativeIsSupported();
}

export function isBackgroundActivityActive(): boolean {
  if (Platform.OS !== 'ios') return false;
  return nativeIsActive();
}

export async function startBackgroundActivitySession(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return nativeStart();
}

export async function stopBackgroundActivitySession(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  return nativeStop();
}
