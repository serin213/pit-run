import React from 'react';
import { BlurView } from '../platform/blur';

/** Header 영역 높이 (BackButton top=safeTop+14 + height≈25 + 24px margin). */
const HEADER_EXTRA_H = 63;

type Props = {
  safeTop: number;
  intensity?: number;
};

export default function TopSafeBlurOverlay({ safeTop, intensity = 60 }: Props) {
  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: safeTop + HEADER_EXTRA_H,
        zIndex: 1000,
      }}
      pointerEvents="none"
    />
  );
}
