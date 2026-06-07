import React from 'react';
import { Image } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { getControlButtonImageSource } from './controlButtonAssets';

interface Props {
  color: string;
  bgColor?: string;
  size?: number;
  /** 묶음 1b-LA: hex teamColor 전달 시 PNG 자산(9색 매핑) 사용. */
  teamColor?: string;
}

export default function PlayButton({ color, bgColor, size = 76, teamColor }: Props) {
  if (teamColor) {
    return (
      <Image
        source={getControlButtonImageSource('play', teamColor)}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 76 76" fill="none">
      <Circle cx="38" cy="38" r="38" fill={bgColor ?? color} fillOpacity={0.2} />
      <Path d="M47.75 36.701C48.75 37.2783 48.75 38.7217 47.75 39.299L34.25 47.0933C33.25 47.6706 32 46.9489 32 45.7942L32 30.2058C32 29.0511 33.25 28.3294 34.25 28.9067L47.75 36.701Z" fill={color} />
    </Svg>
  );
}
