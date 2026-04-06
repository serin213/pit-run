import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface Props {
  visible: boolean;
  onClose: () => void;
  driverName?: string;
  teamColor?: string;
  mode?: 'boxbox' | 'fullPush';
}

const BAR_HEIGHTS = [28, 42, 34, 54, 46, 36, 46, 40, 32, 22, 34, 42, 50];
const SHEET_TOP_TO_DRIVER = 32;
const DRIVER_LINE_HEIGHT = 43;
const WAVE_GROUP_HEIGHT = 58;
const WAVE_BASE_Y_IN_GROUP = 54;
const WAVE_BASE_HEIGHT = 4;
const WAVE_GROUP_TOP = 84;
const WAVE_BASE_TOP = WAVE_GROUP_TOP + WAVE_BASE_Y_IN_GROUP;
const WAVE_BASE_SIDE = 28;
const WAVE_BASE_TO_TITLE_GAP = 16;
const TITLE_TOP = WAVE_BASE_TOP + WAVE_BASE_HEIGHT + WAVE_BASE_TO_TITLE_GAP;
const TITLE_LINE_HEIGHT = 36;
const DETAIL_TOP = 250;
const DETAIL_TEXT_TOP = 242;
const DESC_LINE_HEIGHT = 24;
const DESC_LINES = 2;
const PROGRESS_TOP = 310;
const LABEL_TOP = 328;
const SHEET_BOTTOM_PADDING = 36;
const BOXBOX_BASE_SHEET_HEIGHT = 380;
const FULL_PUSH_BASE_SHEET_HEIGHT = 218;
const WAVE_TARGET_COLUMN_WIDTH = 23;
const WAVE_SIDE_FADE_WIDTH = 38;
const WAVE_COLUMN_OVERLAP = 0.2;

export default function BoxBoxSheet({
  visible,
  onClose,
  driverName = 'LECLERC',
  teamColor = '#E03A3E',
  mode = 'boxbox',
}: Props) {
  const { width: windowW } = useWindowDimensions();
  const [waveTime, setWaveTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const waveStartRef = useRef<number>(0);
  const sheetWidth = windowW - 40;
  const waveWidth = Math.max(1, sheetWidth - WAVE_BASE_SIDE * 2);
  const isFullPush = mode === 'fullPush';
  const sheetHeight = isFullPush
    ? FULL_PUSH_BASE_SHEET_HEIGHT
    : Math.max(BOXBOX_BASE_SHEET_HEIGHT, LABEL_TOP + 16 + SHEET_BOTTOM_PADDING);
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
      const count = Math.max(1, Math.round(waveWidth / WAVE_TARGET_COLUMN_WIDTH));
      const columnWidth = waveWidth / count;
      return Array.from({ length: count }, (_, idx) => {
        const baseHeight = BAR_HEIGHTS[idx % BAR_HEIGHTS.length];
        const seed = barSeeds[idx % barSeeds.length];
        const pace = 5.8 + seed * 2.1;
        const localWave = 0.5 + 0.5 * Math.sin(waveTime * pace + idx * 0.56 + seed * Math.PI * 2);
        const harmonic = 0.5 + 0.5 * Math.sin(waveTime * (pace * 0.5) + idx * 0.2 + 1.2);
        const energy = 0.85 + 0.15 * Math.sin(waveTime * 1.2);
        const mod = (0.5 + localWave * 0.36 + harmonic * 0.14) * energy;
        const animatedHeight = Math.max(12, Math.min(WAVE_BASE_Y_IN_GROUP, baseHeight * mod));
        return {
          x: idx * columnWidth,
          width: columnWidth,
          animatedHeight,
          y: WAVE_BASE_Y_IN_GROUP - animatedHeight,
        };
      });
    },
    [barSeeds, waveTime, waveWidth],
  );

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

  const waveStartColor = `rgba(${Number.parseInt(teamColor.slice(1, 3), 16)},${Number.parseInt(teamColor.slice(3, 5), 16)},${Number.parseInt(teamColor.slice(5, 7), 16)},0)`;
  const waveEndColor = `rgba(${Number.parseInt(teamColor.slice(1, 3), 16)},${Number.parseInt(teamColor.slice(3, 5), 16)},${Number.parseInt(teamColor.slice(5, 7), 16)},1)`;

  if (!visible) return null;

  return (
    <View style={s.root} pointerEvents="box-none">
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={[s.sheet, { height: sheetHeight }]}>
        <Text
          style={[
            s.driver,
            {
              color: teamColor,
              top: isFullPush ? 25 : SHEET_TOP_TO_DRIVER,
            },
          ]}
        >
          {driverName}
        </Text>

        <View style={[s.waveWrap, { top: isFullPush ? 76 : WAVE_GROUP_TOP }]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${waveWidth} ${WAVE_GROUP_HEIGHT}`} preserveAspectRatio="none" fill="none">
            <Defs>
              <LinearGradient id="waveColumn" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={waveStartColor} />
                <Stop offset="100%" stopColor={waveEndColor} />
              </LinearGradient>
              <LinearGradient id="waveLeftFade" x1="0" y1="32" x2={WAVE_SIDE_FADE_WIDTH} y2="32" gradientUnits="userSpaceOnUse">
                <Stop offset="7%" stopColor="#202028" />
                <Stop offset="100%" stopColor="rgba(32,32,40,0)" />
              </LinearGradient>
              <LinearGradient
                id="waveRightFade"
                x1={waveWidth - WAVE_SIDE_FADE_WIDTH}
                y1="32"
                x2={waveWidth}
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="7%" stopColor="rgba(32,32,40,0)" />
                <Stop offset="100%" stopColor="#202028" />
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
            <Rect x={0} y={WAVE_BASE_Y_IN_GROUP} width={waveWidth} height={WAVE_BASE_HEIGHT} fill={teamColor} />
            <Rect x={0} y={-6} width={WAVE_SIDE_FADE_WIDTH} height={64} fill="url(#waveLeftFade)" />
            <Rect x={waveWidth - WAVE_SIDE_FADE_WIDTH} y={-6} width={WAVE_SIDE_FADE_WIDTH} height={64} fill="url(#waveRightFade)" />
          </Svg>
        </View>

        <Text style={[s.title, { top: isFullPush ? 150 : TITLE_TOP }]}>
          {isFullPush ? '“FULL PUSH”' : '“BOX BOX”'}
        </Text>

        {!isFullPush && (
          <>
            <View style={s.warningWrap}>
              <Svg width={44} height={41} viewBox="0 0 44 42" fill="none">
                <Path
                  d="M15.0204 3.00073C7.98038 5.75483 3 12.552 3 20.5007C3 28.4495 7.98038 35.2466 15.0204 38.0007M28.9796 38.0007C36.0196 35.2466 41 28.4495 41 20.5007C41 12.552 36.0196 5.75483 28.9796 3.00073"
                  stroke="#FCB827"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              </Svg>
              <Text style={s.warningMark}>M</Text>
            </View>
            <Text style={s.desc}>Pace got slower{'\n'}Need Recovery</Text>

            <View style={s.progressTrack}>
              <Svg width="100%" height="100%" viewBox="0 0 306 12" preserveAspectRatio="none" fill="none">
                <Rect x="0" y="0" width="306" height="12" rx="6" fill="rgba(255,255,255,0.1)" />
                <Defs>
                  <LinearGradient id="boxboxProgress" x1="0" y1="6" x2="62" y2="6" gradientUnits="userSpaceOnUse">
                    <Stop offset="0%" stopColor="#E03A3E" />
                    <Stop offset="100%" stopColor="#FCB827" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="62" height="12" rx="6" fill="url(#boxboxProgress)" />
              </Svg>
            </View>
            <Text style={s.critical}>Critical</Text>
            <Text style={s.good}>Good</Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: {
    marginHorizontal: 20,
    marginBottom: 26,
    borderRadius: 24,
    backgroundColor: '#202028',
    overflow: 'hidden',
  },
  driver: {
    position: 'absolute',
    right: 28,
    top: SHEET_TOP_TO_DRIVER,
    color: '#E03A3E',
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
    color: '#FFFFFF',
    fontFamily: 'Formula1-Italic',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  warningWrap: {
    position: 'absolute',
    left: 31,
    top: DETAIL_TOP,
    width: 44,
    height: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningMark: {
    position: 'absolute',
    color: '#FCB827',
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  desc: {
    position: 'absolute',
    left: 89,
    top: DETAIL_TEXT_TOP,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Italic',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  progressTrack: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: PROGRESS_TOP,
    height: 12,
  },
  critical: {
    position: 'absolute',
    left: 28,
    top: LABEL_TOP,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.13,
    includeFontPadding: false,
  },
  good: {
    position: 'absolute',
    right: 28,
    top: LABEL_TOP,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.13,
    includeFontPadding: false,
  },
});
