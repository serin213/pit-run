/**
 * GradientCardBorder
 * 카드 박스 공통 래퍼 — fill: #202028 40%, stroke: 1px 대각선(↖→↘) white 그라디언트
 *
 * 구조: 내부 fill View 먼저 → SVG stroke를 맨 위에 렌더링
 *   - SVG가 나중에 오면 CSS stacking 상 항상 위에 그려짐 (z-index 없이도)
 *   - fill에 그라데이션이 비치는 문제 없음 (fill:none stroke-only)
 *   - 탭 전환 시 사라지는 문제 없음 (SVG가 항상 최상위)
 */
import React, { useState } from 'react';
import { Pressable, View, ViewStyle, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { PALETTE } from '../constants/colors';

const STROKE_W = 0.5;
export const CARD_FILL = 'rgba(32, 32, 40, 0.4)';


type Props = {
  style?: ViewStyle | ViewStyle[] | any;
  innerStyle?: ViewStyle | ViewStyle[] | any;
  borderRadius?: number;
  onPress?: () => void;
  children: React.ReactNode;
};

export default function GradientCardBorder({
  style,
  innerStyle,
  borderRadius = 12,
  onPress,
  children,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const Root = onPress ? Pressable : View;

  return (
    <Root
      style={[style, { borderRadius }]}
      onPress={onPress}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - height) > 0.5
            ? { width, height }
            : prev
        );
      }}
    >
      {/* 내부 fill — margin 없이 카드 전체를 채움 */}
      <View
        style={[
          {
            flex: 1,
            borderRadius,
            backgroundColor: CARD_FILL,
            overflow: 'hidden',
          },
          innerStyle,
        ]}
      >
        {children}
      </View>

      {/* SVG stroke — 컨텐츠 다음에 렌더링 → CSS stacking 상 항상 최상위 */}
      {size.width > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient id="cardBorderGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size.width} y2={size.height}>
              <Stop offset="0%" stopColor={PALETTE.white} stopOpacity="0.18" />
              <Stop offset="25%" stopColor={PALETTE.white} stopOpacity="0.06" />
              <Stop offset="75%" stopColor={PALETTE.white} stopOpacity="0.06" />
              <Stop offset="100%" stopColor={PALETTE.white} stopOpacity="0.12" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={STROKE_W / 2}
            y={STROKE_W / 2}
            width={size.width - STROKE_W}
            height={size.height - STROKE_W}
            rx={borderRadius - STROKE_W / 2}
            ry={borderRadius - STROKE_W / 2}
            fill="none"
            stroke="url(#cardBorderGrad)"
            strokeWidth={STROKE_W}
          />
        </Svg>
      )}
    </Root>
  );
}
