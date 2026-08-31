import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DigitColumn from './DigitColumn';
import { LETTER_SPACING } from '../../constants/typography';

interface RollingPNumberProps {
  target: number | null;
  color: string;
  fontSize?: number;
  digitH?: number;
  digitSpacing?: number;
}

export default function RollingPNumber({
  target,
  color,
  fontSize = 100,
  digitH = 110,
  digitSpacing = -4,
}: RollingPNumberProps) {
  const textStyle = useMemo(
    () => ({
      fontFamily: 'Formula1-Black',
      fontSize,
      letterSpacing: LETTER_SPACING.numeric(fontSize),
      includeFontPadding: false,
      color,
    }),
    [color, fontSize],
  );

  if (target === null) {
    return (
      <Text style={[styles.rankText, { color, fontSize, lineHeight: digitH }]}>
        —
      </Text>
    );
  }

  const digits = String(target).split('').map(Number);

  return (
    <View style={{ flexDirection: 'row' }}>
      {digits.map((d, i) => (
        <DigitColumn
          key={i}
          digit={d}
          digitH={digitH}
          textStyle={textStyle}
          delay={i * 100}
          spacing={digitSpacing}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rankText: {
    fontFamily: 'Formula1-Black',
    fontSize: 100,
    lineHeight: 110,
    letterSpacing: LETTER_SPACING.numeric(100),
    includeFontPadding: false,
  },
});
