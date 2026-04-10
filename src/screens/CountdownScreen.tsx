import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import TextChevronButton from '../components/TextChevronButton';
import type { CountdownScreenProps } from '../navigation/types';

const COUNTDOWN_PAGE_MS = 1000;
const DISSOLVE_MS = 120;

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacities = useRef(
    Object.fromEntries(ALL_COUNTS.map((n) => [n, new Animated.Value(n === 5 ? 1 : 0)])) as Record<CountdownValue, Animated.Value>
  ).current;
  const finishCalledRef = useRef(false);

  const finishCountdown = useCallback(() => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    finishCalledRef.current = false;
    ALL_COUNTS.forEach((n) => opacities[n].setValue(n === 5 ? 1 : 0));

    const tick = (n: CountdownValue) => {
      timeoutRef.current = setTimeout(() => {
        if (n <= 0) { finishCountdown(); return; }
        const next = (n - 1) as CountdownValue;
        setCount(next);
        Animated.parallel([
          Animated.timing(opacities[n], { toValue: 0, duration: DISSOLVE_MS, useNativeDriver: true }),
          Animated.timing(opacities[next], { toValue: 1, duration: DISSOLVE_MS, useNativeDriver: true }),
        ]).start();
        tick(next);
      }, COUNTDOWN_PAGE_MS);
    };
    tick(5);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [finishCountdown, opacities]);

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
  container: { flex: 1, backgroundColor: '#17171C', overflow: 'hidden' },
  skipButton: { position: 'absolute', left: 0, right: 0, zIndex: 50, elevation: 50 },
});
