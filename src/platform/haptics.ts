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

function coreHaptics() {
  if (Platform.OS !== 'ios') return null;
  if (!PitRunHaptics) return null;
  try {
    if (typeof PitRunHaptics.isSupported === 'function' && !PitRunHaptics.isSupported()) {
      return null;
    }
  } catch {
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
