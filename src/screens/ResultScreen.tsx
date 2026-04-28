import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import GradientCtaButton from '../components/GradientCtaButton';
import ResultSharePage from './ResultSharePage';
import ScreenHeader from '../components/ScreenHeader';
import TireIcon from '../components/TireIcon';
import { useRunStore } from '../store/runStore';
import { useAppStore } from '../store/appStore';
import { CIRCUITS } from '../config/circuits';
import { getCircuitTheme } from '../config/circuitThemes';
import { fmtTime, fmtPace, fmtDist } from '../utils/format';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import type { ResultScreenProps } from '../navigation/types';
import { useSupabaseSession } from '../hooks/useSupabaseSessions';
import { useAuthStore } from '../store/authStore';
import { logRaceCompleted } from '../lib/analytics/raceEvents';
import { radius } from '../constants/radius';
import { selectCommentary } from '../lib/commentary/selectCommentary';

// ─── Constants ───────────────────────────────────────────────────────────────

const BAR_GAP        = 5;
const GRAPH_SIDE_PAD = 20;
const GRAPH_BAR_H    = 160;
const BAR_RADIUS     = 12;
// Tooltip zone: fastest bubble(53) + tail(10) = 63 (regular: 49)
// Fixed zone height keeps chart position stable when switching sectors.
const TOOLTIP_ZONE   = 63;
const TOOLTIP_GAP    = 4;  // gap between tooltip zone bottom and chart top
// Sector label row below chart
const SECTOR_ROW_H   = 28;
// AVG label text height estimate (fontSize 11)
const AVG_LABEL_TEXT_H = 14;
// 화면 하단에서 48px 고정
const GRAPH_BOTTOM_CLEARANCE = 24;

// Shared paddingTop for page 1 and page 2 content — change here to update both
const PAGE_CONTENT_TOP = 46;

const DIFFICULTY = [
  { id: 'too-easy', emoji: '😴', label: 'Too Easy' },
  { id: 'easy',     emoji: '😊', label: 'Easy'     },
  { id: 'proper',   emoji: '💪', label: 'Proper'   },
  { id: 'hard',     emoji: '😤', label: 'Hard'     },
  { id: 'too-hard', emoji: '🔥', label: 'Too Hard' },
] as const;

// ─── Circuit result images ────────────────────────────────────────────────────
// Static require map: Metro bundler cannot resolve dynamic paths

const CIRCUIT_RESULT_IMAGES: Record<string, number> = {
  'shanghai':    require('../../assets/circuits/results/shanghai.png'),
  'las-vegas':   require('../../assets/circuits/results/lasvegas.png'),
  'suzuka':      require('../../assets/circuits/results/suzuka.png'),
  'monaco':      require('../../assets/circuits/results/monaco.png'),
  'hungaroring': require('../../assets/circuits/results/hungary.png'),
  'marina-bay':  require('../../assets/circuits/results/marinabay.png'),
  'monza':       require('../../assets/circuits/results/monza.png'),
  'baku':        require('../../assets/circuits/results/baku.png'),
  'albert-park': require('../../assets/circuits/results/albertpark.png'),
  'silverstone': require('../../assets/circuits/results/silverstone.png'),
  'spa':         require('../../assets/circuits/results/spa.png'),
};

// ─── Checker-flag images ──────────────────────────────────────────────────────

const CHECKER_FLAG_COLOR: Record<string, string> = {
  'baku':        'teal',
  'monaco':      'red',
  'shanghai':    'red',
  'marina-bay':  'red',
  'hungaroring': 'green',
  'monza':       'green',
  'albert-park': 'blue',
  'silverstone': 'blue',
  'las-vegas':   'blue',
  'spa':         'yellow',
  'suzuka':      'red',
};

const CHECKER_FLAG_IMAGES: Record<string, number> = {
  'teal':   require('../../assets/circuits/checker-flag/teal.png'),
  'red':    require('../../assets/circuits/checker-flag/red.png'),
  'green':  require('../../assets/circuits/checker-flag/green.png'),
  'blue':   require('../../assets/circuits/checker-flag/blue.png'),
  'yellow': require('../../assets/circuits/checker-flag/yellow.png'),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/** SVG path for a rect with bottom-only corner radius */
function bottomRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const r2 = Math.min(r, w / 2, h / 2);
  return (
    `M${x} ${y}` +
    `H${x + w}` +
    `V${y + h - r2}` +
    `Q${x + w} ${y + h} ${x + w - r2} ${y + h}` +
    `H${x + r2}` +
    `Q${x} ${y + h} ${x} ${y + h - r2}` +
    `Z`
  );
}

/** Smooth cubic-Bézier line + closed area path, xs span 0→graphW */
function makeLinePaths(
  paces: number[],
  graphW: number,
  barH: number,
  minP: number,
  paceRange: number,
): { linePath: string; areaPath: string; ys: number[] } {
  const n = paces.length;
  if (n === 0) return { linePath: '', areaPath: '', ys: [] };

  const xs = n === 1
    ? [graphW / 2]
    : paces.map((_, i) => (i / (n - 1)) * graphW);

  const ys = paces.map((pace) => {
    const norm = paceRange > 0 ? (pace - minP) / paceRange : 0.5;
    // faster (lower seconds) → top; slower → bottom
    return barH * 0.1 + barH * 0.8 * norm;
  });

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < n; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }

  const area =
    n > 1
      ? `${d} L ${xs[n - 1]} ${barH} L ${xs[0]} ${barH} Z`
      : '';

  return { linePath: d, areaPath: area, ys };
}

// ─── Circuit SVG (decorative background, page 1) ─────────────────────────────

interface CircuitSvgLargeProps {
  path: string;
  viewBox: { width: number; height: number };
  color: string;
}

function CircuitSvgLarge({ path, viewBox, color }: CircuitSvgLargeProps) {
  const targetH = 275;
  const scale   = targetH / viewBox.height;
  const scaledW = viewBox.width * scale;
  const strokeW = 7 / scale;
  return (
    <View
      style={{ position: 'absolute', left: 83, top: 0, width: scaledW, height: targetH }}
      pointerEvents="none"
    >
      <Svg width={scaledW} height={targetH} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}>
        <Path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.6}
        />
      </Svg>
    </View>
  );
}

// ─── Digit column (slot-machine, per-digit) ──────────────────────────────────

const ROLL_ROUNDS = 1; // full 0-9 rounds before landing

interface DigitColumnProps {
  digit: number;
  digitH: number;
  textStyle: any;
  delay?: number;
  active?: boolean;
  spacing?: number;
}

function DigitColumn({ digit, digitH, textStyle, delay = 0, active = true, spacing = -4 }: DigitColumnProps) {
  // Stack: ROLL_ROUNDS × [0..9] then target digit at the bottom
  const items = useMemo(
    () => Array.from({ length: ROLL_ROUNDS * 10 + 1 }, (_, i) =>
      i < ROLL_ROUNDS * 10 ? i % 10 : digit,
    ),
    [digit],
  );

  const ty = useSharedValue(0);
  const triggered = useRef(false);

  useEffect(() => {
    if (!active || triggered.current) return;
    triggered.current = true;
    ty.value = withDelay(
      delay,
      withTiming(-(ROLL_ROUNDS * 10) * digitH, {
        duration: 700,
        easing: Easing.out(Easing.exp),
      }),
    );
  }, [active, digit, digitH, delay, ty]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  return (
    <View style={{ height: digitH, overflow: 'hidden', marginHorizontal: spacing }}>
      <Reanimated.View style={[{ flexDirection: 'column' }, animStyle]}>
        {items.map((d, i) => (
          <View key={i} style={{ height: digitH, justifyContent: 'center' }}>
            <Text
              allowFontScaling={false}
              style={[textStyle, { lineHeight: digitH, fontVariant: ['tabular-nums'] }]}
            >
              {d}
            </Text>
          </View>
        ))}
      </Reanimated.View>
    </View>
  );
}

// ─── RollingPNumber ───────────────────────────────────────────────────────────

interface RollingPNumberProps {
  target: number | null;
  color: string;
}

function RollingPNumber({ target, color }: RollingPNumberProps) {
  const DIGIT_H = 110;
  const textStyle = useMemo(
    () => ({
      fontFamily: 'Formula1-Black',
      fontSize: 100,
      letterSpacing: -2,
      includeFontPadding: false,
      color,
    }),
    [color],
  );

  if (target === null) {
    return <Text style={[styles.rankText, { color }]}>—</Text>;
  }

  const digits = String(target).split('').map(Number);

  return (
    <View style={{ flexDirection: 'row' }}>
      {digits.map((d, i) => (
        <DigitColumn key={i} digit={d} digitH={DIGIT_H} textStyle={textStyle} delay={i * 100} />
      ))}
    </View>
  );
}

// ─── RollingText ─────────────────────────────────────────────────────────────
// Splits formatted string (e.g. "5'23"") into digit columns + fixed separators.

interface RollingTextProps {
  target: string;
  active: boolean;
  containerStyle?: any;
  textStyle: any;
  digitH: number;
}

function RollingText({ target, active, containerStyle, textStyle, digitH }: RollingTextProps) {
  type Part =
    | { type: 'digit'; value: number; idx: number }
    | { type: 'sep'; ch: string };

  const parts = useMemo<Part[]>(() => {
    let digitCount = 0;
    return [...target].map((ch) =>
      ch >= '0' && ch <= '9'
        ? { type: 'digit', value: parseInt(ch, 10), idx: digitCount++ }
        : { type: 'sep', ch },
    );
  }, [target]);

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, containerStyle]}>
      {parts.map((p, i) =>
        p.type === 'sep'
          ? <Text key={i} allowFontScaling={false} style={textStyle}>{p.ch}</Text>
          : <DigitColumn
              key={i}
              digit={p.value}
              digitH={digitH}
              textStyle={textStyle}
              delay={p.idx * 60}
              active={active}
              spacing={-2}
            />,
      )}
    </View>
  );
}

// ─── BarItem ──────────────────────────────────────────────────────────────────
// Separate component so Reanimated hooks can be called per-bar (hooks-in-loop rule)

interface BarItemProps {
  barW: number;
  isSelected: boolean;
  themeColor: string;
  index: number;
  onPress: () => void;
}

function BarItem({ barW, isSelected, themeColor, index, onPress }: BarItemProps) {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ResultScreen({ navigation }: ResultScreenProps) {
  const { width: screenW } = useWindowDimensions();
  const safeTop    = useSafeTop();
  const safeBottom = useSafeBottom();

  const { distKm, elapsedMs, paceHistory, resetRun } = useRunStore();
  const {
    selectedCircuitId,
    selectedTire,
    qualifyingResult,
    recordActivity,
    addDistance,
    currentRaceEventId,
    setCurrentRaceEventId,
    setSelectedCircuitId,
  } = useAppStore();
  const { endSession }  = useSupabaseSession();
  const { user }        = useAuthStore();

  const circuit            = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
  const topTheme           = getCircuitTheme(circuit.displayName.toUpperCase());
  const themeRgb           = hexToRgb(topTheme.line);
  const circuitResultImage = CIRCUIT_RESULT_IMAGES[circuit.id] ?? null;
  const checkerFlagColor   = CHECKER_FLAG_COLOR[circuit.id] ?? null;
  const checkerFlagImage   = checkerFlagColor ? CHECKER_FLAG_IMAGES[checkerFlagColor] : null;

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalPaceS = distKm > 0 ? elapsedMs / 1000 / distKm : 0;

  // DNF when runner covers less than 98% of circuit distance
  const statusLabel = distKm >= circuit.distanceKm * 0.98 ? 'FINISH' : 'DNF';

  // TODO: 실제 등수 로직 추후 추가
  const rankNumber: number | null = null;

  // ─── Commentary ───────────────────────────────────────────────────────────
  // completedAt: 화면이 마운트된 시각을 한 번만 캡처 (re-render 시 변하지 않음)
  const completedAtRef = useRef(Date.now());
  const commentary = useMemo(() => selectCommentary({
    completedAt:       completedAtRef.current,
    circuitId:         circuit.id,
    tire:              null,   // TODO: run store에 타이어 추가 후 연결
    avgPaceSec:        totalPaceS,
    sectorPaces:       paceHistory,
    isOverallPB:       false,  // TODO: 전체 기록 비교 후 연결
    isCircuitPB:       false,  // TODO: 서킷 기록 비교 후 연결
    goalPaceSec:       null,   // TODO: qualifyingResult 목표 페이스 연결
    userGrade:         qualifyingResult?.grade ?? 'f3',
    nextGradeName:     null,   // TODO: 등급 임계값 정의 후 연결
    nextGradePaceSec:  null,   // TODO: 등급 임계값 정의 후 연결
    totalRaceCount:    0,      // TODO: 유저 히스토리 연결
    daysSinceLastRace: null,   // TODO: 유저 히스토리 연결
    currentStreakDays:  0,      // TODO: 유저 히스토리 연결
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []); // 마운트 시 한 번만 계산

  // ─── Sector paces (1 entry per km) ────────────────────────────────────────

  const sectorCount = Math.max(1, Math.floor(distKm));

  const sectorPaces = useMemo(() => {
    const fallback = totalPaceS > 0 ? totalPaceS : 300;
    if (paceHistory.length === 0) return Array<number>(sectorCount).fill(fallback);
    return Array.from({ length: sectorCount }, (_, i) =>
      paceHistory[i] ?? paceHistory[paceHistory.length - 1] ?? fallback,
    );
  }, [paceHistory, sectorCount, totalPaceS]);

  const fastestSectorIdx = useMemo(
    () => (sectorPaces.length > 0 ? sectorPaces.indexOf(Math.min(...sectorPaces)) : 0),
    [sectorPaces],
  );
  const fastestPaceS = sectorPaces[fastestSectorIdx] ?? totalPaceS;

  // ─── Selected sector (default = fastest) ──────────────────────────────────

  const [selectedSector, setSelectedSector] = useState(0);
  useEffect(() => { setSelectedSector(fastestSectorIdx); }, [fastestSectorIdx]);

  // ─── Animation state / refs ────────────────────────────────────────────────
  // Content shown in tooltip (lags behind selectedSector during cross-fade)
  const [shownSector, setShownSector] = useState(0);
  const prevIsFastestRef = useRef(false);

  // Tooltip slide position (JS driver — layout property)
  const tooltipXAnim = useRef(new Animated.Value(0)).current;
  // Tooltip content cross-fade (native driver)
  const tooltipFadeAnim = useRef(new Animated.Value(1)).current;
  // Skip spring on first mount so tooltip doesn't animate from 0 → correct pos
  const tooltipXMountedRef = useRef(false);

  // ─── Graph geometry ────────────────────────────────────────────────────────

  const graphW = screenW - GRAPH_SIDE_PAD * 2;
  const barW   = Math.max(1, (graphW - BAR_GAP * (sectorCount - 1)) / sectorCount);

  const minPace  = Math.min(...sectorPaces);
  const maxPace  = Math.max(...sectorPaces);
  const paceRange = maxPace - minPace || 1;

  const { linePath, areaPath, ys: lineYs } = useMemo(
    () => makeLinePaths(sectorPaces, graphW, GRAPH_BAR_H, minPace, paceRange),
    [sectorPaces, graphW, minPace, paceRange],
  );

  // AVG pace dashed-line Y position (within GRAPH_BAR_H coordinate space)
  const avgNorm  = paceRange > 0 ? (totalPaceS - minPace) / paceRange : 0.5;
  const avgLineY = GRAPH_BAR_H * 0.1 + GRAPH_BAR_H * 0.8 * Math.max(0, Math.min(1, avgNorm));

  // Tooltip horizontal centre (bar-row coordinates)
  const [tooltipW, setTooltipW] = useState(80);
  const barCenterX  = selectedSector * (barW + BAR_GAP) + barW / 2;
  const tooltipLeft = Math.max(0, Math.min(graphW - tooltipW, barCenterX - tooltipW / 2));

  // ─── Page height & active page ────────────────────────────────────────────

  const TOTAL_PAGES = 3;
  const [pageHeight, setPageHeight] = useState(0);
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const ctaAnim = useRef(new Animated.Value(0)).current;

  const goNextPage = useCallback(() => {
    if (pageHeight > 0 && activePage < TOTAL_PAGES - 1) {
      scrollRef.current?.scrollTo({ y: (activePage + 1) * pageHeight, animated: true });
    }
  }, [activePage, pageHeight]);

  const handlePageChange = useCallback((page: number) => {
    setActivePage(page);
    Animated.timing(ctaAnim, {
      toValue: page === TOTAL_PAGES - 1 ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [ctaAnim]);

  // ─── Sector animation effects ──────────────────────────────────────────────

  // Tooltip position: spring-slide to new bar centre X
  // friction 26 keeps it critically damped → smooth slide, minimal overshoot
  useEffect(() => {
    if (!tooltipXMountedRef.current) {
      tooltipXAnim.setValue(tooltipLeft);
      tooltipXMountedRef.current = true;
      return;
    }
    Animated.spring(tooltipXAnim, {
      toValue: tooltipLeft,
      useNativeDriver: false,
      tension: 180,
      friction: 26,
    }).start();
  }, [tooltipLeft, tooltipXAnim]);

  // Tooltip content: cross-fade when switching between fastest / regular
  useEffect(() => {
    const isFastest = selectedSector === fastestSectorIdx;
    if (isFastest !== prevIsFastestRef.current) {
      prevIsFastestRef.current = isFastest;
      Animated.timing(tooltipFadeAnim, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }).start(() => {
        setShownSector(selectedSector);
        Animated.timing(tooltipFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    } else {
      setShownSector(selectedSector);
    }
  }, [selectedSector, fastestSectorIdx, tooltipFadeAnim]);

  // ─── Evaluation sheet ──────────────────────────────────────────────────────

  const [showSheet, setShowSheet]   = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setShowSheet(true);
    Animated.timing(sheetAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  };

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowSheet(false);
    });
  }, [sheetAnim]);

  const handleConfirm = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowSheet(false);
      recordActivity();
      addDistance(distKm);
      const avgPace  = elapsedMs > 0 && distKm > 0 ? elapsedMs / 1000 / distKm : null;
      const bestPace = paceHistory.length > 0 ? Math.min(...paceHistory) : null;
      endSession({
        status: 'completed',
        total_dist_km: distKm,
        total_time_ms: elapsedMs,
        avg_pace_sec_per_km: avgPace,
        best_pace_sec_per_km: bestPace,
      }).catch(() => {});
      if (user?.id && currentRaceEventId) {
        logRaceCompleted({
          raceStartedEventId: currentRaceEventId,
          userId: user.id,
          completedReps: 0,
          actualHardPace: avgPace ?? 0,
          actualEasyPace: null,
          totalDurationSec: Math.round(elapsedMs / 1000),
        }).catch(() => {});
        setCurrentRaceEventId(null);
      }
      resetRun();
      navigation.navigate('Home');
    });
  }, [
    sheetAnim, resetRun, recordActivity, addDistance, distKm, elapsedMs,
    paceHistory, endSession, user, currentRaceEventId, setCurrentRaceEventId, navigation,
  ]);

  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [340, 0] });
  const overlayOpacity  = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const bgOpacity       = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] });

  const graphBottom = GRAPH_BOTTOM_CLEARANCE + safeBottom;

  // ─── Dev: cycle through circuits ──────────────────────────────────────────
  const devCycleCircuit = useCallback(() => {
    const idx = CIRCUITS.findIndex((c) => c.id === circuit.id);
    const next = CIRCUITS[(idx + 1) % CIRCUITS.length];
    setSelectedCircuitId(next.id);
  }, [circuit.id, setSelectedCircuitId]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Paging content area */}
      <Animated.View style={{ flex: 1, opacity: bgOpacity }}>
      {/* Fixed header */}
      <ScreenHeader
        safeTop={safeTop}
        flagAsset={circuit.flagAsset}
        circuitLabel={circuit.displayName}
        circuitKm={circuit.distanceKm}
        hideKm
        theme={topTheme}
        statusLabel={statusLabel}
      />

      {/* Dev: circuit switcher */}
      {__DEV__ && (
        <Pressable
          onPress={devCycleCircuit}
          style={{ position: 'absolute', top: safeTop + 8, right: 16, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Formula1-Regular' }}>
            {`⟳ ${circuit.displayName}`}
          </Text>
        </Pressable>
      )}
      <View
        style={styles.contentArea}
        onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
      >
        {pageHeight > 0 && (
          <ScrollView
            ref={scrollRef}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.y / pageHeight);
              handlePageChange(page);
            }}
          >
            {/* ─── Page 1: Rank + Flag + Summary ─── */}
            <View style={[styles.page, { height: pageHeight }]}>
              {/* Tap anywhere → next page */}
              <Pressable style={StyleSheet.absoluteFill} onPress={goNextPage} />
              <View style={styles.page1Content}>
                {/* P + rank number + checker flag row */}
                <View style={styles.rankRow}>
                  <Text style={[styles.rankText, { color: topTheme.text }]}>P</Text>
                  <View style={{ width: 8 }} />
                  <RollingPNumber target={12} color={topTheme.text} />
                  {checkerFlagImage && (
                    <>
                      <View style={{ width: 12 }} />
                      <Image
                        source={checkerFlagImage}
                        style={[styles.checkerFlag, { marginTop: -1 }]}
                        resizeMode="contain"
                      />
                    </>
                  )}
                </View>

                {/* Summary text */}
                <Text style={styles.summaryText}>
                  {commentary.message}
                </Text>
              </View>

              {/* Circuit result image — full width, anchored to bottom */}
              {circuitResultImage && (
                <View style={styles.circuitWrap} pointerEvents="none">
                  <Image
                    source={circuitResultImage}
                    style={styles.circuitResultImage}
                    resizeMode="cover"
                  />
                </View>
              )}
            </View>

            {/* ─── Page 2: Stats + Pace graph ─── */}
            <View style={[styles.page, { height: pageHeight }]}>
              {/* Tap anywhere except graph → next page (graph is absolute + rendered later, wins touches) */}
              <Pressable style={StyleSheet.absoluteFill} onPress={goNextPage} />
              {/* Stats */}
              <View style={styles.page2Stats}>
                {/* Distance */}
                <View style={styles.distRow}>
                  <Text style={styles.distNumber}>{fmtDist(distKm)}</Text>
                  <Text style={styles.distUnit}>km</Text>
                </View>

                <Text style={[styles.label, { marginTop: 32 }]}>TIME</Text>
                <RollingText
                  target={fmtTime(elapsedMs)}
                  active={activePage === 1}
                  containerStyle={{ marginTop: 8 }}
                  textStyle={{ fontFamily: 'Formula1-Bold', fontSize: 30, color: '#FFFFFF' }}
                  digitH={36}
                />

                <Text style={[styles.label, { marginTop: 24 }]}>AVG PACE</Text>
                <RollingText
                  target={fmtPace(totalPaceS)}
                  active={activePage === 1}
                  containerStyle={{ marginTop: 8 }}
                  textStyle={{ fontFamily: 'Formula1-Bold', fontSize: 30, color: '#FFFFFF' }}
                  digitH={36}
                />

                <Text style={[styles.label, { marginTop: 24 }]}>TYRE</Text>
                {selectedTire && (
                  <View style={{ marginTop: 12, alignSelf: 'flex-start', marginRight: 24 }}>
                    <TireIcon type={selectedTire} width={30} height={30} />
                  </View>
                )}

              </View>

              {/* ── Pace graph (anchored to bottom) ── */}
              <View
                style={[
                  styles.graphSection,
                  { bottom: graphBottom },
                ]}
              >
                {/* Tooltip zone — fixed height so chart doesn't shift */}
                <View style={{ height: TOOLTIP_ZONE }}>
                  {(() => {
                    const isFastest = shownSector === fastestSectorIdx;
                    const tooltipBg = isFastest
                      ? 'rgba(133,40,197,0.15)'
                      : `rgba(${themeRgb},0.15)`;
                    return (
                      <Animated.View
                        style={[styles.tooltipWrap, { left: tooltipXAnim }]}
                        onLayout={(e) => setTooltipW(e.nativeEvent.layout.width)}
                      >
                        {/* Cross-fade wrapper */}
                        <Animated.View style={{ opacity: tooltipFadeAnim, alignItems: 'center' }}>
                          {/* Bubble */}
                          <View style={[
                            styles.tooltipBubble,
                            { backgroundColor: tooltipBg },
                            isFastest && { paddingTop: 0, paddingBottom: 0 },
                          ]}>
                            {isFastest && (
                              <>
                                {/* Purple icon box */}
                                <View style={styles.fastestIconBox}>
                                  <Image
                                    source={require('../../assets/icons/fastest-lap.png')}
                                    style={{ width: 20, height: 23 }}
                                    resizeMode="contain"
                                  />
                                </View>
                                <View style={{ width: 10 }} />
                                <Text style={styles.fastestLabel}>Fastest Lap</Text>
                                <View style={{ width: 10 }} />
                              </>
                            )}
                            <Text style={styles.tooltipPace}>
                              {fmtPace(sectorPaces[shownSector] ?? totalPaceS)}
                            </Text>
                          </View>
                          {/* Tail — same color as bubble */}
                          <Svg width={14} height={10} viewBox="0 0 14 10">
                            <Path
                              d="M 0 0 H 14 L 9.42 6.05 A 3 3 0 0 1 4.58 6.05 L 0 0 Z"
                              fill={tooltipBg}
                            />
                          </Svg>
                        </Animated.View>
                      </Animated.View>
                    );
                  })()}
                </View>

                {/* Bar row (pressable) + line overlay */}
                <View style={styles.chartArea}>
                  {/* Bars — BarItem handles Reanimated reveal per bar */}
                  <View style={styles.barsRow}>
                    {sectorPaces.map((_, i) => (
                      <BarItem
                        key={i}
                        index={i}
                        barW={barW}
                        isSelected={i === selectedSector}
                        themeColor={topTheme.line}
                        onPress={() => setSelectedSector(i)}
                      />
                    ))}
                  </View>

                  {/* Line + area + avg dashed — overlaid on bars */}
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Svg width={graphW} height={GRAPH_BAR_H}>
                      <Defs>
                        {/* Vertical gradient for area fill */}
                        <LinearGradient id="rsArea" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%"   stopColor={topTheme.line} stopOpacity="0.2" />
                          <Stop offset="100%" stopColor={topTheme.line} stopOpacity="0"   />
                        </LinearGradient>
                        {/* Horizontal gradient for line (fade in/out at edges) */}
                        <LinearGradient
                          id="rsLine"
                          x1="0" y1="0" x2={graphW} y2="0"
                          gradientUnits="userSpaceOnUse"
                        >
                          <Stop offset="0%"   stopColor={topTheme.line} stopOpacity="0" />
                          <Stop offset="10%"  stopColor={topTheme.line} stopOpacity="1" />
                          <Stop offset="90%"  stopColor={topTheme.line} stopOpacity="1" />
                          <Stop offset="100%" stopColor={topTheme.line} stopOpacity="0" />
                        </LinearGradient>
                      </Defs>

                      {/* Area under curve */}
                      {areaPath ? <Path d={areaPath} fill="url(#rsArea)" /> : null}

                      {/* Smooth curve line */}
                      {linePath ? (
                        <Path
                          d={linePath}
                          fill="none"
                          stroke="url(#rsLine)"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}

                      {/* AVG pace dashed line */}
                      <Path
                        d={`M 0 ${avgLineY} L ${graphW} ${avgLineY}`}
                        fill="none"
                        stroke={`rgba(${themeRgb},0.45)`}
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                    </Svg>
                  </View>
                </View>

                {/* AVG label — value only, bottom edge 4px above dashed line */}
                <View
                  style={[
                    styles.avgLabelWrap,
                    {
                      // dashed line sits at TOOLTIP_H + TOOLTIP_GAP + avgLineY inside graphSection
                      // we want label bottom = that position - 4px
                      top: TOOLTIP_ZONE + TOOLTIP_GAP + avgLineY - 2 - AVG_LABEL_TEXT_H,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={[styles.avgLabelText, { color: `rgba(${themeRgb},0.7)` }]}>
                    {fmtPace(totalPaceS)}
                  </Text>
                </View>

                {/* Sector labels */}
                <View style={styles.sectorRow}>
                  {sectorPaces.map((_, i) => (
                    <Pressable
                      key={i}
                      style={{ width: barW, alignItems: 'center' }}
                      onPress={() => setSelectedSector(i)}
                      hitSlop={4}
                    >
                      <Text style={[styles.sectorLabel, { color: topTheme.text }]}>
                        S{i + 1}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            {/* ─── Page 3: Share ─── */}
            <View style={[styles.page, { height: pageHeight }]}>
              <ResultSharePage
                distKm={distKm}
                elapsedMs={elapsedMs}
                totalPaceS={totalPaceS}
                fastestPaceS={fastestPaceS}
                circuitName={circuit.displayName}
                circuitKm={circuit.distanceKm}
                statusLabel={statusLabel}
                flagAsset={circuit.flagAsset}
                trackPath={circuit.trackPath}
                viewBox={circuit.viewBox}
                themeColor={topTheme.line}
              />
            </View>

          </ScrollView>
        )}
      </View>

      {/* Fixed CTA — 마지막 페이지에서만 표시 */}
      <Animated.View
        style={[styles.ctaWrap, { height: 164 + safeBottom, opacity: ctaAnim }]}
        pointerEvents={activePage === TOTAL_PAGES - 1 ? 'box-none' : 'none'}
      >
        <Svg
          width={screenW}
          height={164 + safeBottom}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="ctaFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"  stopColor="#17171C" stopOpacity="0" />
              <Stop offset="35%" stopColor="#17171C" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path
            d={`M0 0 H${screenW} V${164 + safeBottom} H0 Z`}
            fill="url(#ctaFade)"
          />
        </Svg>
        <View style={{ paddingBottom: safeBottom + 16 }}>
          <GradientCtaButton
            height={58}
            label="To the GRID"
            textColor={topTheme.line === '#FCB827' ? '#17171C' : '#FFFFFF'}
            enabled
            onPress={openSheet}
            gradientStart={topTheme.line}
            gradientEnd={topTheme.text}
          />
        </View>
      </Animated.View>
      </Animated.View>

      {/* Evaluation bottom sheet */}
      {showSheet && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY: sheetTranslateY }],
                paddingBottom: 36,
                backgroundColor: 'transparent',
                overflow: 'hidden',
              },
            ]}
          >
            <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(32,32,40,0.35)' }]} />
            <Text style={styles.sheetTitle}>How was it?</Text>

            <View style={styles.emojiTrackWrap}>
              <View style={styles.emojiTrack} />
              <View style={styles.emojiRow}>
                {DIFFICULTY.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.emojiBtn, selectedDiff === opt.id && styles.emojiBtnActive]}
                    onPress={() => { setSelectedDiff(opt.id); handleConfirm(); }}
                  >
                    <Text style={styles.emojiChar}>{opt.emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.emojiLabels}>
              <Text style={styles.emojiLabelEdge}>Too Easy</Text>
              <Text style={styles.emojiLabelCenter}>Proper</Text>
              <Text style={styles.emojiLabelEdge}>Too Hard</Text>
            </View>

          </Animated.View>
        </Animated.View>
      )}

      {/* Safe area top blur */}
      <BlurView
        intensity={60}
        tint="dark"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop, zIndex: 1000 }}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  contentArea: {
    flex: 1,
  },
  page: {
    overflow: 'hidden',
  },

  // ── Page 1 ──
  page1Content: {
    paddingLeft: 20,
    paddingTop: PAGE_CONTENT_TOP,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankText: {
    fontFamily: 'Formula1-Black',
    fontSize: 100,
    lineHeight: 110,
    letterSpacing: -2,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  checkerFlag: {
    width: 92,
    height: 92,
  },
  summaryText: {
    marginTop: 24,
    fontFamily: 'Formula1-Italic',
    fontSize: 24,
    lineHeight: 24 * 1.3,   // 130%
    letterSpacing: 24 * -0.01, // -1%
    color: 'rgba(255,255,255,0.5)',
    paddingRight: 20,
  },
  circuitWrap: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    height: 275,
    overflow: 'hidden',
  },
  circuitResultImage: {
    width: '100%',
    height: '100%',
  },

  // ── Page 2 ──
  page2Stats: {
    paddingLeft: 20,
    paddingTop: PAGE_CONTENT_TOP,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  distNumber: {
    fontFamily: 'Formula1-Black',
    fontSize: 100,
    lineHeight: 110,
    color: '#FFFFFF',
    letterSpacing: 5,
    includeFontPadding: false,
  },
  distUnit: {
    fontFamily: 'Formula1-Regular',
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 6,
  },

  // ── Shared label / value ──
  label: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.26,
  },
  contentValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 36,
  },

  // ── Graph section ──
  graphSection: {
    position: 'absolute',
    left: GRAPH_SIDE_PAD,
    right: GRAPH_SIDE_PAD,
  },

  // Tooltip (HistoryScreen 동일 스타일)
  tooltipWrap: {
    position: 'absolute',
    bottom: 0,           // zone 하단 기준 정렬 → 항상 chart 바로 위에 붙음
    alignItems: 'center',
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 7,
    borderRadius: 12,
    // backgroundColor는 inline으로 적용
  },
  // Fastest Lap 전용
  fastestIconBox: {
    width: 38,
    height: 38,
    backgroundColor: '#8528C5',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // bubble padding 상쇄: 좌우 패딩 안쪽에 바짝 붙도록 negative margin
    marginLeft: -12,
    marginRight: 0,
  },
  fastestLabel: {
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#8528C5',
  },
  tooltipPace: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontStyle: 'italic',
    color: '#FFFFFF',
    opacity: 0.7,
  },

  // Bar columns + line overlay container
  chartArea: {
    marginTop: TOOLTIP_GAP,
    height: GRAPH_BAR_H,
    flexDirection: 'row',
    gap: BAR_GAP,
  },
  barsRow: {
    flexDirection: 'row',
    gap: BAR_GAP,
    ...StyleSheet.absoluteFillObject,
  },

  // AVG label (absolute within graphSection)
  avgLabelWrap: {
    position: 'absolute',
    left: 4,
  },
  avgLabelText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    letterSpacing: -0.22,
  },

  // Sector labels
  sectorRow: {
    flexDirection: 'row',
    gap: BAR_GAP,
    marginTop: 8,
  },
  sectorLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 14,
    opacity: 0.5,
  },

  // ── CTA ──
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
  },

  // ── Sheet ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    zIndex: 500,
  },
  sheet: {
    ...radius.lg,
    marginHorizontal: 20,
    marginBottom: 26,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  sheetTitle: {
    fontFamily: 'Formula1-Regular',
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 32,
    lineHeight: 36,
  },
  emojiTrackWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  emojiTrack: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: 22,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202028',
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 1.2 }],
  },
  emojiChar: {
    fontSize: 26,
  },
  emojiLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  emojiLabelEdge: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.13,
  },
  emojiLabelCenter: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.13,
  },
  confirmBtn: {
    ...radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#34343F',
    opacity: 0.3,
    marginBottom: 8,
  },
  confirmBtnActive: {
    opacity: 1,
    backgroundColor: '#34343F',
  },
  confirmBtnText: {
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.22,
  },
});
