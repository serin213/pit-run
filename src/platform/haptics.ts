/**
 * Haptic feedback abstraction for race cues.
 *
 * iOS:      pit-run-haptics (Core Haptics) — bypasses silent switch, intensity = 1.0.
 *           Falls back to expo-haptics Heavy if engine init fails.
 * Android:  expo-haptics with Heavy style.
 * Toss 미니앱: 이 파일만 교체.
 */

import { Platform } from 'react-native';
import {
  impactAsync,
  notificationAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';
import PitRunHaptics from 'pit-run-haptics';

let _hapticsDiagLogged = false;
function coreHaptics() {
  if (Platform.OS !== 'ios') return null;
  if (!PitRunHaptics) {
    if (!_hapticsDiagLogged) {
      _hapticsDiagLogged = true;
      console.warn('[Haptics] PitRunHaptics native module is null — using expo-haptics fallback (no silent-mode bypass)');
    }
    return null;
  }
  try {
    if (typeof PitRunHaptics.isSupported === 'function' && !PitRunHaptics.isSupported()) {
      if (!_hapticsDiagLogged) {
        _hapticsDiagLogged = true;
        console.warn('[Haptics] PitRunHaptics.isSupported() returned false — using expo-haptics fallback');
      }
      return null;
    }
  } catch (e) {
    if (!_hapticsDiagLogged) {
      _hapticsDiagLogged = true;
      console.warn('[Haptics] isSupported check threw:', e);
    }
    return null;
  }
  return PitRunHaptics;
}

export function singleImpact(): void {
  const core = coreHaptics();
  if (core) {
    core.singleImpact().catch(() => {});
    return;
  }
  impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function doubleImpact(): void {
  const core = coreHaptics();
  if (core) {
    core.doubleImpact().catch(() => {});
    return;
  }
  impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {});
  setTimeout(() => {
    impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {});
  }, 150);
}

export function successLong(): void {
  const core = coreHaptics();
  if (core) {
    core.successLong().catch(() => {});
    return;
  }
  notificationAsync(NotificationFeedbackType.Success).catch(() => {});
}
