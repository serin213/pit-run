import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import GradientCtaButton from '../components/GradientCtaButton';
import ScreenHeader from '../components/ScreenHeader';
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
import { GRADE_DISPLAY_NAME } from '../constants/grade';

// ─── Constants ───────────────────────────────────────────────────────────────

const BAR_GAP = 5;
const GRAPH_SIDE_PAD = 20;
const GRAPH_BAR_H = 160;
// Height taken by AVG label row above the chart
const AVG_LABEL_H = 20;
// Height of sector label row below the chart
const SECTOR_ROW_H = 32;
// Total graph section height
const GRAPH_SECTION_H = AVG_LABEL_H + GRAPH_BAR_H + SECTOR_ROW_H;
// Bottom clearance to keep graph above the CTA gradient
// CTA fade starts at 35% of 164px ≈ 57px; add 48px spec gap + safeBottom margin
const GRAPH_BOTTOM_CLEARANCE = 48 + 57; // will add safeBottom dynamically

const DIFFICULTY = [
  { id: 'too-easy', emoji: '😴', label: 'Too Easy' },
  { id: 'easy',     emoji: '😊', label: 'Easy'     },
  { id: 'proper',   emoji: '💪', label: 'Proper'   },
  { id: 'hard',     emoji: '😤', label: 'Hard'     },
  { id: 'too-hard', emoji: '🔥', label: 'Too Hard' },
] as const;

// ─── Circuit name line-break rules ───────────────────────────────────────────
// At Formula1-Bold 72px with ~350pt usable width (390 - 20*2 margins),
// names longer than ~6 chars need a break.
// Rule: apply break only if it produces exactly 1 newline (both halves fit).
// If the rule would produce >1 break, natural wrapping is used instead.
const CIRCUIT_BREAK_RULES: Record<string, string> = {
  'MONACO':      'MO\nNACO',
  'HUNGARY':     'HUN\nGARY',
  'MARINA BAY':  'MARINA\nBAY',
  'ALBERT PARK': 'ALBERT\nPARK',
  'SHANGHAI':    'SHANG\nHAI',
  'SILVERSTONE': 'SILVER\nSTONE',
  'LAS VEGAS':   'LAS\nVEGAS',
  // BAKU, SPA, MONZA, SUZUKA → fit on one line → no rule needed
  // HUNGARORING (11 chars) → >1 break → natural wrap → no rule
};

function getCircuitNameDisplay(displayName: string): string {
  const upper = displayName.toUpperCase();
  const rule = CIRCUIT_BREAK_RULES[upper];
  if (!rule) return upper;
  return rule;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function makeSvgPath(
  points: { x: number; y: number }[],
  barH: number,
): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cx = (points[i - 1].x + points[i].x) / 2;
    d += ` C ${cx} ${points[i - 1].y}, ${cx} ${points[i].y}, ${points[i].x} ${points[i].y}`;
  }
  const lastX = points[points.length - 1].x;
  const area = `${d} L ${lastX} ${barH} L ${points[0].x} ${barH} Z`;
  return { line: d, area };
}

// ─── Circuit SVG (decorative background, page 1) ─────────────────────────────

interface CircuitSvgLargeProps {
  path: string;
  viewBox: { width: number; height: number };
  color: string;
}

function CircuitSvgLarge({ path, viewBox, color }: CircuitSvgLargeProps) {
  const targetH = 275;
  const scale = targetH / viewBox.height;
  const scaledW = viewBox.width * scale;
  const strokeW = 7 / scale;
  return (
    <View
      style={{ position: 'absolute', left: 83, top: 0, width: scaledW, height: targetH }}
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
  const {
    selectedCircuitId,
    qualifyingResult,
    recordActivity,
    addDistance,
    currentRaceEventId,
    setCurrentRaceEventId,
  } = useAppStore();
  const { endSession } = useSupabaseSession();
  const { user } = useAuthStore();

  const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
  const topTheme = getCircuitTheme(circuit.displayName.toUpperCase());
  const themeRgb = hexToRgb(topTheme.line);

  const circuitNameDisplay = getCircuitNameDisplay(circuit.displayName);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalPaceS = distKm > 0 ? elapsedMs / 1000 / distKm : 0;
  const fastestPaceS = paceHistory.length > 0 ? Math.min(...paceHistory) : totalPaceS;

  const grade = qualifyingResult?.grade ?? 'f3';
  const gradeLabel = GRADE_DISPLAY_NAME[grade].toUpperCase();

  // ─── Sector paces (1 entry per km) ────────────────────────────────────────

  const sectorCount = Math.max(1, Math.floor(distKm));

  const sectorPaces = useMemo(() => {
    const fallback = totalPaceS > 0 ? totalPaceS : 300;
    if (paceHistory.length === 0) return Array(sectorCount).fill(fallback) as number[];
    return Array.from({ length: sectorCount }, (_, i) => {
      return paceHistory[i] ?? paceHistory[paceHistory.length - 1] ?? fallback;
    });
  }, [paceHistory, sectorCount, totalPaceS]);

  // ─── Graph geometry ────────────────────────────────────────────────────────

  const graphW = screenW - GRAPH_SIDE_PAD * 2;
  const barW = Math.max(1, (graphW - BAR_GAP * (sectorCount - 1)) / sectorCount);

  const minPace = Math.min(...sectorPaces);
  const maxPace = Math.max(...sectorPaces);
  const paceRange = maxPace - minPace || 1;

  const linePoints = useMemo(
    () =>
      sectorPaces.map((pace, i) => {
        const x = i * (barW + BAR_GAP) + barW / 2;
        const normalized = (pace - minPace) / paceRange;
        const y = GRAPH_BAR_H * 0.1 + GRAPH_BAR_H * 0.8 * normalized;
        return { x, y };
      }),
    [sectorPaces, barW, minPace, paceRange],
  );

  const { line: linePath, area: areaPath } = useMemo(
    () => makeSvgPath(linePoints, GRAPH_BAR_H),
    [linePoints],
  );

  // Avg pace dashed line Y position
  const avgNormalized = paceRange > 0 ? (totalPaceS - minPace) / paceRange : 0.5;
  const avgLineY = GRAPH_BAR_H * 0.1 + GRAPH_BAR_H * 0.8 * Math.max(0, Math.min(1, avgNormalized));

  // ─── Page layout height ────────────────────────────────────────────────────

  const [pageHeight, setPageHeight] = useState(0);

  // ─── Evaluation sheet ──────────────────────────────────────────────────────

  const [showSheet, setShowSheet] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setShowSheet(true);
    Animated.timing(sheetAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  };

  const handleConfirm = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowSheet(false);
      recordActivity();
      addDistance(distKm);
      const avgPace = elapsedMs > 0 && distKm > 0 ? elapsedMs / 1000 / distKm : null;
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
  const overlayOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const graphBottom = GRAPH_BOTTOM_CLEARANCE + safeBottom;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Fixed header */}
      <ScreenHeader
        safeTop={safeTop}
        flagAsset={circuit.flagAsset}
        circuitLabel={circuit.displayName}
        circuitKm={circuit.distanceKm}
        theme={topTheme}
        statusLabel="FINISH"
      />

      {/* Paging content area */}
      <View
        style={styles.contentArea}
        onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
      >
        {pageHeight > 0 && (
          <ScrollView
            pagingEnabled
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            scrollEventThrottle={16}
          >
            {/* ── Page 1: Circuit name + Grade pos + Global rank ── */}
            <View style={[styles.page, { height: pageHeight }]}>
              <View style={styles.page1Content}>
                {/* Circuit name */}
                <Text style={[styles.circuitName, { color: topTheme.text }]}>
                  {circuitNameDisplay}
                </Text>

                {/* Grade POS */}
                <Text style={[styles.label, { marginTop: 72 }]}>{gradeLabel} POS</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>—</Text>

                {/* Global Rank */}
                <Text style={[styles.label, { marginTop: 42 }]}>GLOBAL RANK</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>—%</Text>
              </View>

              {/* Decorative circuit SVG */}
              <View style={styles.circuitWrap} pointerEvents="none">
                {circuit.viewBox && (
                  <CircuitSvgLarge
                    path={circuit.trackPath}
                    viewBox={circuit.viewBox}
                    color={topTheme.line}
                  />
                )}
              </View>
            </View>

            {/* ── Page 2: Stats + Pace graph ── */}
            <View style={[styles.page, { height: pageHeight }]}>
              {/* Stats */}
              <View style={styles.page2Stats}>
                {/* Distance */}
                <View style={styles.distRow}>
                  <Text style={styles.distNumber}>{fmtDist(distKm)}</Text>
                  <Text style={styles.distUnit}>km</Text>
                </View>

                {/* TIME */}
                <Text style={[styles.label, { marginTop: 32 }]}>TIME</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>{fmtTime(elapsedMs)}</Text>

                {/* AVG PACE */}
                <Text style={[styles.label, { marginTop: 24 }]}>AVG PACE</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>{fmtPace(totalPaceS)}</Text>

                {/* FASTEST */}
                <Text style={[styles.label, { marginTop: 24 }]}>FASTEST</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>{fmtPace(fastestPaceS)}</Text>
              </View>

              {/* Pace graph — anchored to bottom */}
              <View
                style={[
                  styles.graphSection,
                  { bottom: graphBottom, height: GRAPH_SECTION_H },
                ]}
              >
                {/* AVG pace label — positioned above the dashed line */}
                <View style={[styles.avgLabelWrap, { top: avgLineY - AVG_LABEL_H }]}>
                  <Text style={[styles.avgLabelText, { color: `rgba(${themeRgb},0.7)` }]}>
                    AVG {fmtPace(totalPaceS)}
                  </Text>
                </View>

                {/* Chart SVG */}
                <View style={{ marginTop: AVG_LABEL_H }}>
                  <Svg width={graphW} height={GRAPH_BAR_H}>
                    <Defs>
                      <LinearGradient id="rBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={topTheme.line} stopOpacity="0" />
                        <Stop offset="100%" stopColor={topTheme.line} stopOpacity="0.9" />
                      </LinearGradient>
                      <LinearGradient id="rAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={topTheme.line} stopOpacity="0.3" />
                        <Stop offset="100%" stopColor={topTheme.line} stopOpacity="0" />
                      </LinearGradient>
                      <LinearGradient id="rLineGrad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0%"   stopColor={topTheme.line} stopOpacity="0"   />
                        <Stop offset="10%"  stopColor={topTheme.line} stopOpacity="1"   />
                        <Stop offset="90%"  stopColor={topTheme.line} stopOpacity="0.3" />
                        <Stop offset="100%" stopColor={topTheme.line} stopOpacity="0"   />
                      </LinearGradient>
                    </Defs>

                    {/* Bar columns */}
                    {sectorPaces.map((_, i) => {
                      const x = i * (barW + BAR_GAP);
                      return (
                        <Path
                          key={i}
                          d={`M${x} 0 L${x + barW} 0 L${x + barW} ${GRAPH_BAR_H} L${x} ${GRAPH_BAR_H} Z`}
                          fill="url(#rBarGrad)"
                          opacity={0.55}
                        />
                      );
                    })}

                    {/* Area fill under curve */}
                    {areaPath ? <Path d={areaPath} fill="url(#rAreaGrad)" /> : null}

                    {/* Smooth curve line */}
                    {linePath ? (
                      <Path
                        d={linePath}
                        fill="none"
                        stroke="url(#rLineGrad)"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {/* Avg pace dashed line */}
                    <Path
                      d={`M 0 ${avgLineY} L ${graphW} ${avgLineY}`}
                      fill="none"
                      stroke={`rgba(${themeRgb},0.45)`}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                  </Svg>
                </View>

                {/* Sector labels */}
                <View style={[styles.sectorRow, { width: graphW }]}>
                  {sectorPaces.map((_, i) => (
                    <View key={i} style={[styles.sectorCell, { width: barW }]}>
                      <Text style={[styles.sectorLabel, { color: topTheme.text }]}>
                        S{i + 1}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Fixed CTA */}
      <View
        style={[styles.ctaWrap, { height: 164 + safeBottom }]}
        pointerEvents="box-none"
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
            label="Finish Race"
            enabled
            onPress={openSheet}
            gradientStart={topTheme.line}
            gradientEnd={topTheme.text}
          />
        </View>
      </View>

      {/* Evaluation bottom sheet */}
      {showSheet && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleConfirm} />
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY: sheetTranslateY }],
                paddingBottom: safeBottom + 16,
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
                    onPress={() => setSelectedDiff(opt.id)}
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

            <Pressable
              style={[styles.confirmBtn, selectedDiff && styles.confirmBtnActive]}
              onPress={selectedDiff ? handleConfirm : undefined}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </Pressable>
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

  // Paging content area
  contentArea: {
    flex: 1,
  },

  // Each page
  page: {
    overflow: 'hidden',
  },

  // ── Page 1 ──
  page1Content: {
    paddingLeft: 20,
    paddingTop: 77,
  },
  circuitName: {
    fontFamily: 'Formula1-Bold',
    fontSize: 72,
    lineHeight: 82,
    includeFontPadding: false,
  },
  circuitWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 275,
    overflow: 'hidden',
  },

  // ── Page 2 ──
  page2Stats: {
    paddingLeft: 20,
    paddingTop: 66,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
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

  // ── Graph ──
  graphSection: {
    position: 'absolute',
    left: GRAPH_SIDE_PAD,
    right: GRAPH_SIDE_PAD,
  },
  avgLabelWrap: {
    position: 'absolute',
    left: 0,
    // top is set dynamically
  },
  avgLabelText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    letterSpacing: -0.22,
  },
  sectorRow: {
    flexDirection: 'row',
    gap: BAR_GAP,
    marginTop: 6,
  },
  sectorCell: {
    alignItems: 'center',
  },
  sectorLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 15,
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

  // ── Evaluation sheet ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    zIndex: 500,
  },
  sheet: {
    borderTopLeftRadius: radius.lg.borderRadius,
    borderTopRightRadius: radius.lg.borderRadius,
    borderCurve: radius.lg.borderCurve,
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
