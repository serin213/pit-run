import React from 'react';
import { Image } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { getControlButtonImageSource } from './controlButtonAssets';

interface Props {
  color: string;
  bgColor?: string;
  size?: number;
  /** 묶음 1b-LA: hex teamColor 전달 시 PNG 자산(9색 매핑) 사용. */
  teamColor?: string;
}

export default function StopButton({ color, bgColor, size = 76, teamColor }: Props) {
  if (teamColor) {
    return (
      <Image
        source={getControlButtonImageSource('stop', teamColor)}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 76 76" fill="none">
      <Circle cx="38" cy="38" r="38" fill={bgColor ?? color} fillOpacity={0.2} />
      <Rect x={30} y={30} width={16} height={16} rx={1} fill={color} />
    </Svg>
  );
}
