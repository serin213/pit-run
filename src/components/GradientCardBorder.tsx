/**
 * GradientCardBorder
 * 카드 박스 공통 래퍼 — fill: #202028 40%, stroke: 0.5px 좌→중→우 white 그라디언트
 */
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BORDER_W = 0.5;
export const CARD_FILL = 'rgba(32, 32, 40, 0.4)';
export const GRAD_COLORS = [
  'rgba(255,255,255,0.15)',
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.15)',
] as const;
export const GRAD_LOCS = [0, 0.5, 1] as const;
export const GRAD_START = { x: 0, y: 0.5 };
export const GRAD_END = { x: 1, y: 0.5 };

type Props = {
  /** 외부 레이아웃 스타일 (position, width, height, flex, marginTop …) */
  style?: ViewStyle | ViewStyle[] | any;
  /** 내부 콘텐츠 스타일 (padding, flexDirection, gap …) */
  innerStyle?: ViewStyle | ViewStyle[] | any;
  borderRadius?: number;
  children: React.ReactNode;
};

export default function GradientCardBorder({
  style,
  innerStyle,
  borderRadius = 12,
  children,
}: Props) {
  return (
    <LinearGradient
      colors={GRAD_COLORS}
      locations={GRAD_LOCS}
      start={GRAD_START}
      end={GRAD_END}
      style={[style, { borderRadius, padding: BORDER_W }]}
    >
      <View
        style={[
          {
            flex: 1,
            borderRadius: borderRadius - BORDER_W,
            backgroundColor: CARD_FILL,
            overflow: 'hidden',
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}
