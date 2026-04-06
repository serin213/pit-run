import React from 'react';
import Svg, { Path } from 'react-native-svg';

type Props = {
  trackPath: string;
  viewBox: { width: number; height: number };
  width: number;
  height: number;
};

/** 홈·Next race 카드용 미니 서킷 트랙 */
export default function CircuitMini({ trackPath, viewBox, width: W, height: H }: Props) {
  const scale = Math.min(W / viewBox.width, H / viewBox.height);
  const tx = (W - viewBox.width * scale) / 2;
  const ty = (H - viewBox.height * scale) / 2;
  return (
    <Svg width={W} height={H}>
      <Path
        d={trackPath}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3.25 / scale}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${tx},${ty}) scale(${scale})`}
      />
    </Svg>
  );
}
