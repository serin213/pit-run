import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { bottomRoundedRect } from '../../lib/utils/svgPath';

const GRAPH_BAR_H = 160;
const BAR_RADIUS  = 12;

interface BarItemProps {
  barW: number;
  isSelected: boolean;
  themeColor: string;
  index: number;
  onPress: () => void;
}

export default function BarItem({ barW, isSelected, themeColor, index, onPress }: BarItemProps) {
  const revealH = useSharedValue(0);

  useEffect(() => {
    revealH.value = withSpring(isSelected ? GRAPH_BAR_H : 0, {
      damping: 22,
      stiffness: 200,
      mass: 1,
    });
  }, [isSelected, revealH]);

  const revealStyle = useAnimatedStyle(() => ({
    height: revealH.value,
  }));

  const bgId  = `rsBarBg${index}`;
  const selId = `rsBarSel${index}`;

  return (
    <Pressable onPress={onPress} style={{ width: barW }} hitSlop={4}>
      {/* Layer 1: Static dim background — always full height, no animation */}
      <Svg width={barW} height={GRAPH_BAR_H}>
        <Defs>
          <LinearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={themeColor} stopOpacity="0" />
            <Stop offset="100%" stopColor={themeColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path
          d={bottomRoundedRect(0, 0, barW, GRAPH_BAR_H, BAR_RADIUS)}
          fill={`url(#${bgId})`}
          opacity={0.05}
        />
      </Svg>

      {/* Layer 2: Reveal overlay — height springs 0 → GRAPH_BAR_H from bottom */}
      <Reanimated.View
        style={[
          revealStyle,
          { position: 'absolute', bottom: 0, width: barW, overflow: 'hidden' },
        ]}
      >
        <Svg
          width={barW}
          height={GRAPH_BAR_H}
          style={{ position: 'absolute', bottom: 0 }}
        >
          <Defs>
            <LinearGradient id={selId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor={themeColor} stopOpacity="0" />
              <Stop offset="100%" stopColor={themeColor} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path
            d={bottomRoundedRect(0, 0, barW, GRAPH_BAR_H, BAR_RADIUS)}
            fill={`url(#${selId})`}
            opacity={0.5}
          />
        </Svg>
      </Reanimated.View>
    </Pressable>
  );
}
