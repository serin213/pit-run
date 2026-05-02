import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const ROLL_ROUNDS = 1;

interface DigitColumnProps {
  digit: number;
  digitH: number;
  textStyle: any;
  delay?: number;
  active?: boolean;
  spacing?: number;
}

export default function DigitColumn({
  digit,
  digitH,
  textStyle,
  delay = 0,
  active = true,
  spacing = -4,
}: DigitColumnProps) {
  const items = useMemo(
    () => Array.from({ length: ROLL_ROUNDS * 10 + 1 }, (_, i) =>
      i < ROLL_ROUNDS * 10 ? i % 10 : digit,
    ),
    [digit],
  );

  const ty = useSharedValue(0);
  const triggered = useRef(false);

  useEffect(() => {
    if (!active || triggered.current) return;
    triggered.current = true;
    ty.value = withDelay(
      delay,
      withTiming(-(ROLL_ROUNDS * 10) * digitH, {
        duration: 700,
        easing: Easing.out(Easing.exp),
      }),
    );
  }, [active, digit, digitH, delay, ty]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  return (
    <View style={{ height: digitH, overflow: 'hidden', marginHorizontal: spacing }}>
      <Reanimated.View style={[{ flexDirection: 'column' }, animStyle]}>
        {items.map((d, i) => (
          <View key={i} style={{ height: digitH, justifyContent: 'center' }}>
            <Text
              allowFontScaling={false}
              style={[textStyle, { lineHeight: digitH, fontVariant: ['tabular-nums'] }]}
            >
              {d}
            </Text>
          </View>
        ))}
      </Reanimated.View>
    </View>
  );
}
