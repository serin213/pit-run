/**
 * Alert icon — 20×20 red circle with white "!" mark.
 * Inline SVG of assets/alert.svg (since metro doesn't transform SVG by default).
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: number;
}

export default function AlertIcon({ size = 20 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={10} fill="#E03A3E" />
      <Path
        d="M10 6V10.5"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 13.9883V13.9983"
        stroke="white"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
