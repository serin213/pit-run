/**
 * GradientCardBorder
 * 카드 박스 공통 래퍼 — fill: #202028 40%, stroke: 0.5px 좌→중→우 white 그라디언트
 * SVG stroke-only 방식: 그라데이션이 border 영역에만 그려져 fill에 영향 없음
 */
import React, { useState } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

const BORDER_W = 0.5;
export const CARD_FILL = 'rgba(32, 32, 40, 0.4)';

// expo-linear-gradient를 직접 사용하는 파일(CircuitCard, RaceScreen)용 상수
export const GRAD_COLORS = [
  'rgba(255,255,255,0.15)',
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.15)',
] as const;
export const GRAD_LOCS = [0, 0.5, 1] as const;
export const GRAD_START = { x: 0, y: 0.5 };
export const GRAD_END = { x: 1, y: 0.5 };

type Props = {
  /** 외부 레이아웃 스타일 (position, width, height, flex, margin …) */
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
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      style={[style, { borderRadius }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - height) > 0.5
            ? { width, height }
            : prev
        );
      }}
    >
      {/* SVG gradient border — stroke only, fill:none → fill 영역에 그라데이션 없음 */}
      {size.width > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient id="cardBorderGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={BORDER_W / 2}
            y={BORDER_W / 2}
            width={size.width - BORDER_W}
            height={size.height - BORDER_W}
            rx={borderRadius - BORDER_W / 2}
            ry={borderRadius - BORDER_W / 2}
            fill="none"
            stroke="url(#cardBorderGrad)"
            strokeWidth={BORDER_W}
          />
        </Svg>
      )}

      {/* 내부 콘텐츠 — fill color, 그라데이션 영향 없음 */}
      <View
        style={[
          {
            flex: 1,
            margin: BORDER_W,
            borderRadius: borderRadius - BORDER_W,
            backgroundColor: CARD_FILL,
            overflow: 'hidden',
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
