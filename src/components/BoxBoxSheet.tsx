import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from '../platform/blur';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { radius } from '../constants/radius';
import { PALETTE } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  driverName?: string;
  teamColor?: string;
  mode?: 'boxbox' | 'fullPush';
  onVisibilityChange?: (visible: boolean) => void;
}

const BAR_HEIGHTS = [28, 42, 34, 54, 46, 36, 46, 40, 32, 22, 34, 42, 50];
const SHEET_TOP_TO_DRIVER = 32;
const DRIVER_LINE_HEIGHT = 43;
const WAVE_GROUP_HEIGHT = 58;
const WAVE_BASE_Y_IN_GROUP = 54;
const WAVE_GROUP_TOP = 84;
const WAVE_BASE_TOP = WAVE_GROUP_TOP + WAVE_BASE_Y_IN_GROUP;
const WAVE_BASE_SIDE = 28;
const WAVE_BASE_TO_TITLE_GAP = 16;
const TITLE_TOP = WAVE_BASE_TOP + 4 + WAVE_BASE_TO_TITLE_GAP;
const SHEET_BOTTOM_PADDING = 36;
const BOXBOX_BASE_SHEET_HEIGHT = 266;
const FULL_PUSH_BASE_SHEET_HEIGHT = 218;
const WAVE_MIN_COLUMN_WIDTH = 32;
const WAVE_COLUMN_OVERLAP = 0.2;

export default function BoxBoxSheet({
  visible,
  onClose,
  driverName = 'LECLERC',
  teamColor = PALETTE.red,
  mode = 'boxbox',
}: Props) {
  const { width: windowW } = useWindowDimensions();
  const [waveTime, setWaveTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const waveStartRef = useRef<number>(0);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [340, 0] });
  const overlayOpacity  = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const sheetWidth = windowW - 40;
  const waveWidth = Math.max(1, sheetWidth - WAVE_BASE_SIDE * 2);
  const colCount = Math.max(1, Math.floor(waveWidth / WAVE_MIN_COLUMN_WIDTH));
  const colWidth = waveWidth / colCount;
  const fadeWidth = colWidth * 2;
  const isFullPush = mode === 'fullPush';
  const sheetHeight = isFullPush ? FULL_PUSH_BASE_SHEET_HEIGHT : BOXBOX_BASE_SHEET_HEIGHT;
  const barSeeds = useMemo(
    () =>
      Array.from({ length: 64 }, (_, idx) => {
        const seed = Math.sin((idx + 1) * 12.9898) * 43758.5453;
        return seed - Math.floor(seed);
      }),
    [],
  );
  const waveColumns = useMemo(
    () => {
      return Array.from({ length: colCount }, (_, idx) => {
        const baseHeight = BAR_HEIGHTS[idx % BAR_HEIGHTS.length];
        const seed = barSeeds[idx % barSeeds.length];
        const pace = 5.8 + seed * 2.1;
        const localWave = 0.5 + 0.5 * Math.sin(waveTime * pace + idx * 0.56 + seed * Math.PI * 2);
        const harmonic = 0.5 + 0.5 * Math.sin(waveTime * (pace * 0.5) + idx * 0.2 + 1.2);
        const energy = 0.85 + 0.15 * Math.sin(waveTime * 1.2);
        const mod = (0.5 + localWave * 0.36 + harmonic * 0.14) * energy;
        const animatedHeight = Math.max(12, Math.min(WAVE_BASE_Y_IN_GROUP, baseHeight * mod));
        return {
          x: idx * colWidth,
          width: colWidth,
          animatedHeight,
          y: WAVE_BASE_Y_IN_GROUP - animatedHeight,
        };
      });
    },
    [barSeeds, waveTime, colCount, colWidth],
  );

  useEffect(() => {
    Animated.timing(sheetAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 320 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible, sheetAnim]);

  useEffect(() => {
    if (!visible) return;
    waveStartRef.current = 0;
    const loop = (ts: number) => {
      if (!waveStartRef.current) waveStartRef.current = ts;
      const elapsedSec = (ts - waveStartRef.current) / 1000;
      setWaveTime(elapsedSec);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      waveStartRef.current = 0;
    };
  }, [visible]);

  const r = Number.parseInt(teamColor.slice(1, 3), 16);
  const g = Number.parseInt(teamColor.slice(3, 5), 16);
  const b = Number.parseInt(teamColor.slice(5, 7), 16);
  const waveEndColor = `rgba(${r},${g},${b},1)`;

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
      <BlurView intensity={10} tint="dark" style={[styles.sheet, { height: sheetHeight }]}>
        <View style={{ flex: 1, backgroundColor: 'rgba(32,32,40,0.35)' }}>
          <Text style={[styles.driver, { color: teamColor, top: isFullPush ? 25 : SHEET_TOP_TO_DRIVER }]}>
            {driverName}
          </Text>

          <View style={[styles.waveWrap, { top: isFullPush ? 76 : WAVE_GROUP_TOP }]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${waveWidth} ${WAVE_GROUP_HEIGHT}`} preserveAspectRatio="none" fill="none">
              <Defs>
                <LinearGradient id="waveColumn" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={waveEndColor} stopOpacity={0} />
                  <Stop offset="5%" stopColor={waveEndColor} stopOpacity={0} />
                  <Stop offset="100%" stopColor={waveEndColor} stopOpacity={1} />
                </LinearGradient>
                <LinearGradient id="fadeLeft" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={fadeWidth} y2="0">
                  <Stop offset="0%" stopColor="#16161C" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#16161C" stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="fadeRight" gradientUnits="userSpaceOnUse" x1={waveWidth} y1="0" x2={waveWidth - fadeWidth} y2="0">
                  <Stop offset="0%" stopColor="#16161C" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#16161C" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {waveColumns.map((col, idx) => (
                <Rect
                  key={`wave-col-${idx}`}
                  x={Math.max(0, col.x - WAVE_COLUMN_OVERLAP / 2)}
                  y={col.y}
                  width={col.width + WAVE_COLUMN_OVERLAP}
                  height={col.animatedHeight}
                  fill="url(#waveColumn)"
                />
              ))}
              <Rect x={0} y={0} width={fadeWidth} height={WAVE_GROUP_HEIGHT} fill="url(#fadeLeft)" />
              <Rect x={waveWidth - fadeWidth} y={0} width={fadeWidth} height={WAVE_GROUP_HEIGHT} fill="url(#fadeRight)" />
            </Svg>
          </View>

          <Text style={[styles.title, { top: isFullPush ? 150 : TITLE_TOP }]}>
            {isFullPush ? '"FULL PUSH"' : '"BOX BOX\n RECOVERY TIME"'}
          </Text>
        </View>
      </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    marginHorizontal: 20,
    marginBottom: 26,
    ...radius.lg,
    overflow: 'hidden',
  },
  driver: {
    position: 'absolute',
    right: 28,
    top: SHEET_TOP_TO_DRIVER,
    color: PALETTE.red,
    fontFamily: 'Formula1-Bold',
    fontSize: 36,
    lineHeight: DRIVER_LINE_HEIGHT,
    includeFontPadding: false,
    letterSpacing: 0,
  },
  waveWrap: {
    position: 'absolute',
    left: WAVE_BASE_SIDE,
    right: WAVE_BASE_SIDE,
    top: WAVE_GROUP_TOP,
    height: WAVE_GROUP_HEIGHT,
  },
  title: {
    position: 'absolute',
    left: 28,
    top: TITLE_TOP,
    color: PALETTE.white,
    fontFamily: 'Formula1-Italic',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
});
