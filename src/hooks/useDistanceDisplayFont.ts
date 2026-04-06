import { useMemo, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';

const FRAME_WIDTH = 402;
const DISTANCE_LEFT_BASE = 36;
const DISTANCE_BASE_FONT_SIZE = 130.2486572265625;
const DISTANCE_LINE_HEIGHT_RATIO = 156 / DISTANCE_BASE_FONT_SIZE;

type UseDistanceDisplayFontResult = {
  fontSize: number;
  lineHeight: number;
  sampleText: string;
  onSampleLayout: (event: LayoutChangeEvent) => void;
};

export function useDistanceDisplayFont(windowWidth: number): UseDistanceDisplayFontResult {
  const [sampleWidth, setSampleWidth] = useState(0);

  const distanceLeft = DISTANCE_LEFT_BASE; // fixed 36pt margin, not scaled
  const availableWidth = windowWidth - distanceLeft * 2;

  const fontSize = useMemo(() => {
    if (sampleWidth <= 0) return DISTANCE_BASE_FONT_SIZE;
    const scale = Math.min(1, availableWidth / sampleWidth);
    return DISTANCE_BASE_FONT_SIZE * scale;
  }, [availableWidth, sampleWidth]);

  const lineHeight = fontSize * DISTANCE_LINE_HEIGHT_RATIO;

  return {
    fontSize,
    lineHeight,
    sampleText: '9999.99',
    onSampleLayout: (event) => {
      const width = event.nativeEvent.layout.width;
      if (width > 0 && Math.abs(width - sampleWidth) > 0.5) setSampleWidth(width);
    },
  };
}
