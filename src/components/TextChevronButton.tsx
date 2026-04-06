import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
};

export default function TextChevronButton({ label, onPress, style, hitSlop = 12 }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.wrap, style]} hitSlop={hitSlop}>
      <Text style={styles.label}>{label}</Text>
      <Svg width={20} height={13} viewBox="0 0 20 13" style={styles.icon}>
        <Path
          d="M1.5 1.5L7 6.5L1.5 11.5"
          stroke="#FFFFFF"
          strokeOpacity={0.5}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M11.5 1.5L17 6.5L11.5 11.5"
          stroke="#FFFFFF"
          strokeOpacity={0.5}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.48,
    includeFontPadding: false,
  },
  icon: {
    marginLeft: 4,
  },
});
