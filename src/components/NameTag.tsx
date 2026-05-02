import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

let _ntCounter = 0;

const H = 26;
const PAD_LEFT = 14;
const PAD_RIGHT = 7;
const MIN_WIDTH = 47;

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
  const gradId = useRef(`ntGrad_${++_ntCounter}`).current;
  const [svgW, setSvgW] = useState(MIN_WIDTH);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w !== svgW) setSvgW(w);
  };

  return (
    <View style={s.wrap} onLayout={onLayout}>
      <Svg
        width={svgW}
        height={H}
        viewBox={`0 0 ${svgW} ${H}`}
        fill="none"
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <LinearGradient id={gradId} x1={gradientX1} y1={gradientY1} x2={gradientX2} y2={gradientY2}>
            <Stop offset="0%" stopColor={colorStart} />
            <Stop offset="100%" stopColor={colorEnd} />
          </LinearGradient>
        </Defs>
        <Rect x="2" y="2" width={svgW - 4} height="22" rx="4.5" fill="#181E27" />
        <Rect x="2" y="2" width={svgW - 4} height="22" rx="4.5" fill="none" stroke={`url(#${gradId})`} strokeWidth="4" />
        <Rect x="8" y="8" width="2" height="10" fill={accentColor} />
      </Svg>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: H,
    minWidth: MIN_WIDTH,
    paddingLeft: PAD_LEFT,
    paddingRight: PAD_RIGHT,
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
    lineHeight: 12,
    color: '#FFFFFF',
    includeFontPadding: false,
    textTransform: 'uppercase',
  },
});
