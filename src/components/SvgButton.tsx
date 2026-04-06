import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

type Props = {
  width: number;
  height: number;
  label: string;
  radius?: number;
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
};

export default function SvgButton({
  width,
  height,
  label,
  radius = 12,
  fill,
  fillOpacity = 1,
  stroke,
  strokeWidth = 0,
  textColor = '#FFFFFF',
  fontSize = 14,
  fontFamily = 'Formula1-Regular',
}: Props) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect
        x={strokeWidth / 2}
        y={strokeWidth / 2}
        width={Math.max(0, width - strokeWidth)}
        height={Math.max(0, height - strokeWidth)}
        rx={radius}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <SvgText
        x="50%"
        y="50%"
        fill={textColor}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontWeight="700"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {label}
      </SvgText>
    </Svg>
  );
}
