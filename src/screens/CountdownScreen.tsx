import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Asset } from 'expo-asset';
import TextChevronButton from '../components/TextChevronButton';
import { COLORS } from '../constants/colors';
import { playSound, preloadSounds } from '../platform/audio';
import { singleImpact } from '../platform/haptics';
import {
  isLiveActivitySupported,
  startLiveActivity,
  endLiveActivity,
  getCurrentActivityId,
} from '../platform/liveActivity';
import { useAppStore } from '../store/appStore';
import type { CountdownScreenProps } from '../navigation/types';

const COUNTDOWN_PAGE_MS = 1000;
const DISSOLVE_MS = 120;
const HAPTIC_AT_MS = 5000;
const FINISH_AT_MS = 6500;

type CountdownValue = 5 | 4 | 3 | 2 | 1 | 0;
const ALL_COUNTS: CountdownValue[] = [5, 4, 3, 2, 1, 0];

const NUMBER_SOURCE: Record<CountdownValue, any> = {
  5: require('../../assets/countdown/number-5.png'),
  4: require('../../assets/countdown/number-4.png'),
  3: require('../../assets/countdown/number-3.png'),
  2: require('../../assets/countdown/number-2.png'),
  1: require('../../assets/countdown/number-1.png'),
  0: require('../../assets/countdown/number-0.png'),
};

export default function CountdownScreen({ navigation }: CountdownScreenProps) {
  const onFinish = useCallback(() => navigation.replace('Running'), [navigation]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [count, setCount] = useState<CountdownValue>(5);
  const [previousCount, setPreviousCount] = useState<CountdownValue | null>(null);
  const opacities = useRef(
    Object.fromEntries(ALL_COUNTS.map((n) => [n, new Animated.Value(n === 5 ? 1 : 0)])) as Record<CountdownValue, Animated.Value>
  ).current;
  const finishCalledRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const finishCountdown = useCallback(() => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;
    clearAllTimers();
    onFinish();
  }, [onFinish, clearAllTimers]);

  useEffect(() => {
    let cancelled = false;

    finishCalledRef.current = false;
    ALL_COUNTS.forEach((n) => opacities[n].setValue(n === 5 ? 1 : 0));

    // Start Live Activity NOW (while foreground) so it survives if the user
    // locks the screen during the countdown. RunningScreen will reuse this id.
    if (isLiveActivitySupported()) {
      const { profile, selectedCircuitId } = useAppStore.getState();
      startLiveActivity(
        profile.displayName,
        profile.nameTagAccentColor,
        selectedCircuitId ?? 'shanghai',
      ).catch(() => {});
    }

    (async () => {
      try {
        await Promise.all(
          ALL_COUNTS.map((n) => Asset.fromModule(NUMBER_SOURCE[n]).downloadAsync())
        );
      } catch {}
      if (cancelled) return;

      preloadSounds(['boxbox', 'fullPush', 'finalLap', 'chequeredFlag', 'qualifyingEnd']);

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled) return;

      const startedAt = Date.now();
      playSound('countdown');

      const scheduleAt = (offsetMs: number, fn: () => void) => {
        const delay = Math.max(0, startedAt + offsetMs - Date.now());
        const id = setTimeout(() => {
          if (cancelled || finishCalledRef.current) return;
          fn();
        }, delay);
        timersRef.current.push(id);
      };

      for (let i = 1; i <= 5; i++) {
        const from = (6 - i) as CountdownValue;
        const to = (5 - i) as CountdownValue;
        scheduleAt(i * COUNTDOWN_PAGE_MS, () => {
          setPreviousCount(from);
          setCount(to);
          Animated.parallel([
            Animated.timing(opacities[from], { toValue: 0, duration: DISSOLVE_MS, useNativeDriver: true }),
            Animated.timing(opacities[to],   { toValue: 1, duration: DISSOLVE_MS, useNativeDriver: true }),
          ]).start();
        });
      }

      scheduleAt(HAPTIC_AT_MS, () => singleImpact());
      scheduleAt(FINISH_AT_MS, () => finishCountdown());
    })();

    return () => {
      cancelled = true;
      clearAllTimers();
      // If we're unmounting WITHOUT having navigated to Running (e.g. user backed out),
      // clean up the Live Activity we started. RunningScreen path leaves it for useRunning.
      if (!finishCalledRef.current) {
        const id = getCurrentActivityId();
        if (id) endLiveActivity(id).catch(() => {});
      }
    };
  }, [finishCountdown, opacities, clearAllTimers]);

  const imageStyle = { width: screenWidth, height: screenHeight };

  return (
    <View style={styles.container}>
      {ALL_COUNTS.map((n) => (
        <Animated.Image
          key={n}
          source={NUMBER_SOURCE[n]}
          style={[StyleSheet.absoluteFill, imageStyle, { opacity: opacities[n] }]}
          resizeMode="stretch"
        />
      ))}
      {count > 0 && (
        <TextChevronButton
          label="Skip"
          onPress={finishCountdown}
          style={[styles.skipButton, { bottom: 55 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, overflow: 'hidden' },
  skipButton: { position: 'absolute', left: 0, right: 0, zIndex: 50, elevation: 50 },
});
