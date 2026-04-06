import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

// 인스턴스별 고유 ID — 여러 NameTag가 동시에 렌더될 때 ID 충돌 방지
let _ntCounter = 0;

interface Props {
  label?: string;
  colorStart: string;
  colorEnd: string;
  accentColor?: string;
  gradientX1?: number;
  gradientY1?: number;
  gradientX2?: number;
  gradientY2?: number;
}

export default function NameTag({
  label = 'LEC',
  colorStart,
  colorEnd,
  accentColor = '#E03A3E',
  gradientX1 = 0,
  gradientY1 = 0.5,
  gradientX2 = 1,
  gradientY2 = 0.5,
}: Props) {
  // 마운트 시 한 번만 할당 — 언마운트 후 재마운트해도 새 ID 발급
  const gradId = useRef(`ntGrad_${++_ntCounter}`).current;

  return (
    <View style={s.wrap}>
      <Svg width={47} height={26} viewBox="0 0 47 26" fill="none" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id={gradId} x1={gradientX1} y1={gradientY1} x2={gradientX2} y2={gradientY2}>
            <Stop offset="0%" stopColor={colorStart} />
            <Stop offset="100%" stopColor={colorEnd} />
          </LinearGradient>
        </Defs>
        <Rect x="2" y="2" width="43" height="22" rx="4.5" fill="#181E27" />
        <Rect x="2" y="2" width="43" height="22" rx="4.5" fill="none" stroke={`url(#${gradId})`} strokeWidth="4" />
        <Rect x="8" y="8" width="2" height="10" fill={accentColor} />
      </Svg>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: 47, height: 26, position: 'relative' },
  label: {
    position: 'absolute',
    left: 14,
    top: 7,
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
    lineHeight: 12,
    color: '#FFFFFF',
    includeFontPadding: false,
    textTransform: 'capitalize',
  },
});
