import React from 'react';
import { Image } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { getControlButtonImageSource } from './controlButtonAssets';

interface Props {
  color: string;
  bgColor?: string;
  size?: number;
  /** 묶음 1b: 이미지 아이콘 사용 여부. true면 PNG 아이콘(yellow), false/생략이면 SVG 색상화. */
  useImage?: boolean;
}

export default function StopButton({ color, bgColor, size = 76, useImage }: Props) {
  if (useImage) {
    return (
      <Image
        source={getControlButtonImageSource('stop')}
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
