import React, { useId } from 'react';
import { StyleSheet, useWindowDimensions, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { COLORS } from '../constants/colors';

export const CTA_AREA_HEIGHT = 164;

type Props = {
  height?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'box-none' | 'none' | 'auto';
};

export default function CtaFadeBackground({
  height = CTA_AREA_HEIGHT,
  children,
  style,
  pointerEvents = 'box-none',
}: Props) {
  const { width: windowW } = useWindowDimensions();
  const rawId = useId();
  const gradId = `ctaFade_${rawId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  return (
    <View style={[styles.container, { height }, style]} pointerEvents={pointerEvents}>
      <Svg width={windowW} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor={COLORS.bg} stopOpacity="1" />
            <Stop offset="66%" stopColor={COLORS.bg} stopOpacity="1" />
            <Stop offset="100%" stopColor={COLORS.bg} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={windowW} height={height} fill={`url(#${gradId})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
