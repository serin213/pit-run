import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import GradientCtaButton from '../components/GradientCtaButton';
import { useRunStore } from '../store/runStore';
import { useAppStore } from '../store/appStore';
import { CIRCUITS } from '../config/circuits';
import { getCircuitTheme } from '../config/circuitThemes';
import { fmtTime, fmtPace } from '../utils/format';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import type { ResultScreenProps } from '../navigation/types';


const FASTEST_COLOR = '#8528C5';
const FASTEST_BG = 'rgba(133,40,197,0.15)';

// ─── Difficulty ──────────────────────────────────────────────────────────────

const DIFFICULTY = [
  { id: 'too-easy', emoji: '😴', label: 'Too Easy' },
  { id: 'easy', emoji: '😊', label: 'Easy' },
  { id: 'proper', emoji: '💪', label: 'Proper' },
  { id: 'hard', emoji: '😤', label: 'Hard' },
  { id: 'too-hard', emoji: '🔥', label: 'Too Hard' },
] as const;

// ─── Constants ───────────────────────────────────────────────────────────────

const SECTOR_COUNT = 5;
const BAR_GAP = 5;
// Figma: chart group 346×293, bars frame starts at y=52 inside group
const CHART_SIDE_PAD = 28;
const BAR_H = 209;
// CTA area height: gradient fade (top) + button + safeBottom padding
const CTA_H = 164;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function makeSvgPath(
  points: { x: number; y: number }[],
): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cx = (points[i - 1].x + points[i].x) / 2;
    d += ` C ${cx} ${points[i - 1].y}, ${cx} ${points[i].y}, ${points[i].x} ${points[i].y}`;
  }
  const lastX = points[points.length - 1].x;
  const area = `${d} L ${lastX} ${BAR_H} L ${points[0].x} ${BAR_H} Z`;
  return { line: d, area };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface CircuitSvgLargeProps {
  path: string;
  viewBox: { width: number; height: number };
  color: string;
}

function CircuitSvgLarge({ path, viewBox, color }: CircuitSvgLargeProps) {
  // Scale so height = ~275px, let it overflow on the right (starts at x=83)
  const targetH = 275;
  const scale = targetH / viewBox.height;
  const scaledW = viewBox.width * scale;
  const strokeW = 7 / scale; // visual ~7px stroke

  return (
    <View
      style={{
        position: 'absolute',
        left: 83,
        top: 0,
        width: scaledW,
        height: targetH,
        overflow: 'visible',
      }}
      pointerEvents="none"
    >
      <Svg
        width={scaledW}
        height={targetH}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      >
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ResultScreen({ navigation }: ResultScreenProps) {
  const { width: screenW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const { distKm, elapsedMs, paceHistory, resetRun } = useRunStore();
  const { selectedCircuitId, recordActivity, addDistance } = useAppStore();

  const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
  const circuitLabel = circuit.displayName.toUpperCase();
  const topTheme = getCircuitTheme(circuitLabel);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalPaceS = distKm > 0 ? elapsedMs / 1000 / distKm : 0;
  const fastestPaceS = paceHistory.length > 0 ? Math.min(...paceHistory) : totalPaceS;

  const sectorPaces = useMemo(() => {
    const fallback = totalPaceS > 0 ? totalPaceS : 300;
    if (paceHistory.length === 0) return Array(SECTOR_COUNT).fill(fallback) as number[];
    const size = Math.ceil(paceHistory.length / SECTOR_COUNT);
    return Array.from({ length: SECTOR_COUNT }, (_, i) => {
      const slice = paceHistory.slice(i * size, (i + 1) * size);
      if (slice.length === 0) return paceHistory[paceHistory.length - 1] ?? fallback;
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
  }, [paceHistory, totalPaceS]);

  const fastestSectorIdx = useMemo(() => {
    let minIdx = 0;
    sectorPaces.forEach((p, i) => {
      if (p < sectorPaces[minIdx]) minIdx = i;
    });
    return minIdx;
  }, [sectorPaces]);

  // ─── Chart geometry ────────────────────────────────────────────────────────

  const chartW = screenW - CHART_SIDE_PAD * 2;
  const barW = (chartW - BAR_GAP * (SECTOR_COUNT - 1)) / SECTOR_COUNT;

  const minPace = Math.min(...sectorPaces);
  const maxPace = Math.max(...sectorPaces);
  const paceRange = maxPace - minPace || 1;

  const linePoints = useMemo(
    () =>
      sectorPaces.map((pace, i) => {
        const x = i * (barW + BAR_GAP) + barW / 2;
        // Faster = higher on the chart (lower y value)
        const normalized = (pace - minPace) / paceRange; // 0=fastest, 1=slowest
        const y = BAR_H * 0.1 + BAR_H * 0.8 * normalized;
        return { x, y };
      }),
    [sectorPaces, barW, minPace, paceRange],
  );

  const { line: linePath, area: areaPath } = useMemo(
    () => makeSvgPath(linePoints),
    [linePoints],
  );

  // ─── Interaction ───────────────────────────────────────────────────────────

  const [selectedSector, setSelectedSector] = useState<number | null>(null);

  const isFastestSelected = selectedSector === fastestSectorIdx;
  const activeColor = isFastestSelected ? FASTEST_COLOR : topTheme.line;
  const activeTextColor = isFastestSelected ? FASTEST_COLOR : topTheme.text;

  const handleSectorPress = useCallback(
    (i: number) => setSelectedSector((prev) => (prev === i ? null : i)),
    [],
  );

  // ─── Evaluation sheet ──────────────────────────────────────────────────────

  const [showSheet, setShowSheet] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setShowSheet(true);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  };

  const handleConfirm = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowSheet(false);
      recordActivity();
      addDistance(distKm);
      resetRun();
      navigation.navigate('Home');
    });
  }, [sheetAnim, resetRun, recordActivity, addDistance, distKm, navigation]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [340, 0],
  });

  const overlayOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // ─── Share ─────────────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `🏎 ${circuit.displayName} | ${distKm.toFixed(2)}km\nTime: ${fmtTime(elapsedMs)} | Avg: ${fmtPace(totalPaceS)} | Best: ${fmtPace(fastestPaceS)}`,
      });
    } catch {
      // ignore
    }
  }, [circuit.displayName, distKm, elapsedMs, totalPaceS, fastestPaceS]);

  // ─── Tooltip position ──────────────────────────────────────────────────────

  const tooltipSector = selectedSector ?? fastestSectorIdx;
  const tooltipX = tooltipSector * (barW + BAR_GAP);
  const tooltipPace = sectorPaces[tooltipSector] ?? totalPaceS;
  const tooltipIsFastest = tooltipSector === fastestSectorIdx;

  // ─── Render ────────────────────────────────────────────────────────────────

  const themeRgb = hexToRgb(topTheme.line);

  return (
    <View style={styles.root}>
      {/* ── Fixed header bar ── */}
      <View style={[styles.header, { paddingTop: safeTop }]}>
        <View style={styles.headerRow}>
          {/* Flag + circuit name */}
          <View style={styles.headerLeft}>
            {circuit.flagAsset ? (
              <View style={styles.flagWrap}>
                <Image source={circuit.flagAsset} style={styles.flagImage} resizeMode="cover" />
              </View>
            ) : null}
            <Text style={styles.circuitName} numberOfLines={1}>
              {circuit.displayName.toUpperCase()} ({circuit.distanceKm.toFixed(2)}km)
            </Text>
          </View>
          <Text style={[styles.finishLabel, { color: topTheme.text }]}>FINISH</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: topTheme.line }]} />
      </View>

      {/* ── Scroll content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: safeBottom + 96 }}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {/* ── Hero section ── */}
        <View style={styles.hero}>
          {/* Distance number */}
          <Text style={styles.distanceNumber} numberOfLines={1}>
            {distKm.toFixed(2)}
          </Text>

          {/* Stats */}
          <View style={styles.statsBlock}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>TIME</Text>
              <Text style={styles.statValue}>{fmtTime(elapsedMs)}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>PACE AVG</Text>
              <Text style={styles.statValue}>{fmtPace(totalPaceS)}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>FASTEST</Text>
              <Text style={styles.statValue}>{fmtPace(fastestPaceS)}</Text>
            </View>
          </View>

          {/* Large circuit SVG (intentionally cropped) */}
          <View style={styles.circuitWrap}>
            {circuit.viewBox && (
              <CircuitSvgLarge
                path={circuit.trackPath}
                viewBox={circuit.viewBox}
                color={topTheme.line}
              />
            )}
          </View>
        </View>

        {/* ── Chart section ── */}
        <View style={[styles.chartSection, { paddingHorizontal: CHART_SIDE_PAD }]}>
          {/* Tooltip row */}
          <View style={[styles.tooltipRow, { width: chartW }]}>
            <View
              style={[
                styles.tooltipBox,
                {
                  left: Math.max(0, Math.min(tooltipX, chartW - 88)),
                  backgroundColor: tooltipIsFastest
                    ? FASTEST_BG
                    : `rgba(${themeRgb},0.15)`,
                },
              ]}
            >
              {tooltipIsFastest && (
                <Text style={[styles.tooltipFastest, { color: FASTEST_COLOR }]}>
                  Fastest
                </Text>
              )}
              <Text style={[styles.tooltipPace, { opacity: 0.7 }]}>{fmtPace(tooltipPace)}</Text>
            </View>
          </View>

          {/* Bar + line chart */}
          <View style={{ width: chartW, height: BAR_H }}>
            <Svg width={chartW} height={BAR_H}>
              <Defs>
                {/* Gradient for each bar column (transparent → theme) */}
                <LinearGradient id="resultBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={activeColor} stopOpacity="0" />
                  <Stop offset="100%" stopColor={activeColor} stopOpacity="1" />
                </LinearGradient>
                {/* Area fill under the line */}
                <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={activeColor} stopOpacity="0.2" />
                  <Stop offset="100%" stopColor={activeColor} stopOpacity="0" />
                </LinearGradient>
                {/* Line stroke gradient */}
                <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor={activeColor} stopOpacity="0" />
                  <Stop offset="10%" stopColor={activeColor} stopOpacity="1" />
                  <Stop offset="90%" stopColor={activeColor} stopOpacity="0.2" />
                  <Stop offset="100%" stopColor={activeColor} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* Bar columns */}
              {sectorPaces.map((_, i) => {
                const x = i * (barW + BAR_GAP);
                const isActive = selectedSector === null || selectedSector === i;
                return (
                  <Path
                    key={i}
                    d={`M${x} 0 L${x + barW} 0 L${x + barW} ${BAR_H} L${x} ${BAR_H} Z`}
                    fill="url(#resultBarGrad)"
                    opacity={isActive ? 1 : 0.3}
                  />
                );
              })}

              {/* Area under line */}
              {areaPath ? <Path d={areaPath} fill="url(#areaGrad)" /> : null}

              {/* Line */}
              {linePath ? (
                <Path
                  d={linePath}
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {/* Tooltip caret for selected sector */}
              {selectedSector !== null && (
                <Polygon
                  points={`${linePoints[selectedSector].x - 8},${BAR_H} ${linePoints[selectedSector].x + 8},${BAR_H} ${linePoints[selectedSector].x},${linePoints[selectedSector].y + 12}`}
                  fill={tooltipIsFastest ? FASTEST_COLOR : topTheme.line}
                  opacity={0.6}
                />
              )}
            </Svg>
          </View>

          {/* Sector touch areas + labels */}
          <View style={[styles.sectorRow, { width: chartW }]}>
            {sectorPaces.map((_, i) => (
              <Pressable
                key={i}
                style={[styles.sectorBtn, { width: barW }]}
                onPress={() => handleSectorPress(i)}
              >
                <Text
                  style={[
                    styles.sectorLabel,
                    {
                      color:
                        i === fastestSectorIdx && selectedSector === i
                          ? FASTEST_COLOR
                          : topTheme.text,
                      opacity: selectedSector === null || selectedSector === i ? 0.7 : 0.4,
                    },
                  ]}
                >
                  S{i + 1}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Share ── */}
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share to Instagram</Text>
        </Pressable>
      </ScrollView>

      {/* ── Fixed CTA ── */}
      <View style={[styles.ctaWrap, { height: CTA_H + safeBottom }]} pointerEvents="box-none">
        {/* Fade gradient: transparent → solid #17171C (covers full area including safeBottom) */}
        <Svg
          width={screenW}
          height={CTA_H + safeBottom}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="resultFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#17171C" stopOpacity="0" />
              <Stop offset="35%" stopColor="#17171C" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path d={`M0 0 H${screenW} V${CTA_H + safeBottom} H0 Z`} fill="url(#resultFade)" />
        </Svg>
        <View style={{ paddingBottom: safeBottom + 16 }}>
          <GradientCtaButton
            width={screenW - 56}
            height={58}
            label="Finish Race"
            enabled
            onPress={openSheet}
            gradientStart={topTheme.line}
            gradientEnd={topTheme.text}
          />
        </View>
      </View>

      {/* ── Evaluation bottom sheet ── */}
      {showSheet && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleConfirm} />
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: sheetTranslateY }], paddingBottom: safeBottom + 16 },
            ]}
          >
            <Text style={styles.sheetTitle}>How was it?</Text>

            {/* Emoji scale */}
            <View style={styles.emojiTrackWrap}>
              <View style={styles.emojiTrack} />
              <View style={styles.emojiRow}>
                {DIFFICULTY.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.emojiBtn,
                      selectedDiff === opt.id && styles.emojiBtnActive,
                    ]}
                    onPress={() => setSelectedDiff(opt.id)}
                  >
                    <Text style={styles.emojiChar}>{opt.emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Labels */}
            <View style={styles.emojiLabels}>
              <Text style={styles.emojiLabelEdge}>Too Easy</Text>
              <Text style={styles.emojiLabelCenter}>Proper</Text>
              <Text style={styles.emojiLabelEdge}>Too Hard</Text>
            </View>

            {/* Confirm */}
            <Pressable
              style={[styles.confirmBtn, selectedDiff && styles.confirmBtnActive]}
              onPress={selectedDiff ? handleConfirm : undefined}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      {/* Safe area blocker top */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: safeTop,
          backgroundColor: '#17171C',
          zIndex: 1000,
        }}
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

  // ── Header ──
  header: {
    backgroundColor: '#17171C',
    zIndex: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  flagWrap: {
    width: 22,
    height: 14,
    borderRadius: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  flagImage: {
    width: '100%',
    height: '100%',
  },
  circuitName: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.34,
    flex: 1,
  },
  finishLabel: {
    fontFamily: 'Formula1-Bold',
    fontSize: 17,
    letterSpacing: -0.34,
  },
  divider: {
    height: 4,
    width: '100%',
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },

  // ── Hero ──
  hero: {
    paddingLeft: 28,
    paddingTop: 48,
    paddingBottom: 0,
    minHeight: 290,
    overflow: 'hidden',
  },
  distanceNumber: {
    fontFamily: 'Formula1-Black',
    fontSize: 110,
    lineHeight: 132,
    color: '#FFFFFF',
    letterSpacing: 5.5,
    includeFontPadding: false,
  },
  statsBlock: {
    marginTop: 16,
    marginBottom: 0,
    gap: 0,
  },
  statCol: {
    marginBottom: 24,
  },
  statLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.26,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
  },

  // ── Circuit hero SVG ──
  circuitWrap: {
    height: 275,
    marginTop: 8,
    overflow: 'visible',
  },

  // ── Chart ──
  chartSection: {
    marginTop: 32,
    marginBottom: 0,
  },
  tooltipRow: {
    height: 52,
    position: 'relative',
    marginBottom: 0,
  },
  tooltipBox: {
    position: 'absolute',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    minWidth: 72,
    alignItems: 'center',
    bottom: 10,
  },
  tooltipFastest: {
    fontFamily: 'Formula1-Bold',
    fontSize: 11,
    marginBottom: 2,
  },
  tooltipPace: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  sectorRow: {
    flexDirection: 'row',
    gap: BAR_GAP,
    marginTop: 8,
  },
  sectorBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectorLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    color: '#FFFFFF',
  },

  // ── Share ──
  shareBtn: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'flex-start',
  },
  shareBtnText: {
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 24,
  },

  // ── CTA ──
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CTA_H,
    paddingHorizontal: 28,
    justifyContent: 'flex-end',
  },

  // ── Sheet ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    zIndex: 500,
  },
  sheet: {
    backgroundColor: '#202028',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
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
    marginBottom: 32,
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
    borderRadius: 12,
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
