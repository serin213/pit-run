import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DigitColumn from './DigitColumn';

const DIGIT_H = 110;

interface RollingPNumberProps {
  target: number | null;
  color: string;
}

export default function RollingPNumber({ target, color }: RollingPNumberProps) {
  const textStyle = useMemo(
    () => ({
      fontFamily: 'Formula1-Black',
      fontSize: 100,
      letterSpacing: -2,
      includeFontPadding: false,
      color,
    }),
    [color],
  );

  if (target === null) {
    return <Text style={[styles.rankText, { color }]}>—</Text>;
  }

  const digits = String(target).split('').map(Number);

  return (
    <View style={{ flexDirection: 'row' }}>
      {digits.map((d, i) => (
        <DigitColumn key={i} digit={d} digitH={DIGIT_H} textStyle={textStyle} delay={i * 100} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rankText: {
    fontFamily: 'Formula1-Black',
    fontSize: 100,
    lineHeight: 110,
    letterSpacing: -2,
    includeFontPadding: false,
  },
});
