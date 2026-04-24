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

const DIFFICULTY = [
  { id: 'too-easy', emoji: '😴', label: 'Too Easy' },
  { id: 'easy',     emoji: '😊', label: 'Easy'     },
  { id: 'proper',   emoji: '💪', label: 'Proper'   },
  { id: 'hard',     emoji: '😤', label: 'Hard'     },
  { id: 'too-hard', emoji: '🔥', label: 'Too Hard' },
] as const;

// ─── Circuit name line-break rules ───────────────────────────────────────────
const CIRCUIT_BREAK_RULES: Record<string, string> = {
  'MONACO':      'MO\nNACO',
  'HUNGARY':     'HUN\nGARY',
  'MARINA BAY':  'MARINA\nBAY',
  'ALBERT PARK': 'ALBERT\nPARK',
  'SHANGHAI':    'SHANG\nHAI',
  'SILVERSTONE': 'SILVER\nSTONE',
  'LAS VEGAS':   'LAS\nVEGAS',
};

function getCircuitNameDisplay(displayName: string): string {
  const upper = displayName.toUpperCase();
  return CIRCUIT_BREAK_RULES[upper] ?? upper;
}

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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ResultScreen({ navigation }: ResultScreenProps) {
  const { width: screenW } = useWindowDimensions();
  const safeTop    = useSafeTop();
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
  const { endSession }  = useSupabaseSession();
  const { user }        = useAuthStore();

  const circuit          = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
  const topTheme         = getCircuitTheme(circuit.displayName.toUpperCase());
  const themeRgb         = hexToRgb(topTheme.line);
  const circuitNameDisplay = getCircuitNameDisplay(circuit.displayName);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalPaceS   = distKm > 0 ? elapsedMs / 1000 / distKm : 0;
  const grade        = qualifyingResult?.grade ?? 'f3';
  const gradeLabel   = GRADE_DISPLAY_NAME[grade].toUpperCase();

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
  const ctaAnim = useRef(new Animated.Value(0)).current;

  const handlePageChange = useCallback((page: number) => {
    setActivePage(page);
    Animated.timing(ctaAnim, {
      toValue: page === TOTAL_PAGES - 1 ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [ctaAnim]);

  // ─── Evaluation sheet ──────────────────────────────────────────────────────

  const [showSheet, setShowSheet]   = useState(false);
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
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.y / pageHeight);
              handlePageChange(page);
            }}
          >
            {/* ─── Page 1: Circuit name + Grade pos + Global rank ─── */}
            <View style={[styles.page, { height: pageHeight }]}>
              <View style={styles.page1Content}>
                <Text style={[styles.circuitName, { color: topTheme.text }]}>
                  {circuitNameDisplay}
                </Text>

                <Text style={[styles.label, { marginTop: 72 }]}>{gradeLabel} POS</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>—</Text>

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

            {/* ─── Page 2: Stats + Pace graph ─── */}
            <View style={[styles.page, { height: pageHeight }]}>
              {/* Stats */}
              <View style={styles.page2Stats}>
                {/* Distance */}
                <View style={styles.distRow}>
                  <Text style={styles.distNumber}>{fmtDist(distKm)}</Text>
                  <Text style={styles.distUnit}>km</Text>
                </View>

                <Text style={[styles.label, { marginTop: 32 }]}>TIME</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>{fmtTime(elapsedMs)}</Text>

                <Text style={[styles.label, { marginTop: 24 }]}>AVG PACE</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>{fmtPace(totalPaceS)}</Text>

                <Text style={[styles.label, { marginTop: 24 }]}>FASTEST</Text>
                <Text style={[styles.contentValue, { marginTop: 8 }]}>{fmtPace(fastestPaceS)}</Text>

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
                    const isFastest  = selectedSector === fastestSectorIdx;
                    const tooltipBg  = isFastest
                      ? 'rgba(133,40,197,0.15)'
                      : `rgba(${themeRgb},0.15)`;
                    return (
                      <View
                        style={[styles.tooltipWrap, { left: tooltipLeft }]}
                        onLayout={(e) => setTooltipW(e.nativeEvent.layout.width)}
                      >
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
                            {fmtPace(sectorPaces[selectedSector] ?? totalPaceS)}
                          </Text>
                        </View>
                        {/* Tail — same color as bubble */}
                        <Svg width={14} height={10} viewBox="0 0 14 10">
                          <Path
                            d="M 0 0 H 14 L 9.42 6.05 A 3 3 0 0 1 4.58 6.05 L 0 0 Z"
                            fill={tooltipBg}
                          />
                        </Svg>
                      </View>
                    );
                  })()}
                </View>

                {/* Bar row (pressable) + line overlay */}
                <View style={styles.chartArea}>
                  {/* Bars — individual pressable columns */}
                  <View style={styles.barsRow}>
                    {sectorPaces.map((_, i) => {
                      const isSelected = i === selectedSector;
                      return (
                        <Pressable
                          key={i}
                          onPress={() => setSelectedSector(i)}
                          style={{ width: barW }}
                          hitSlop={4}
                        >
                          <Svg width={barW} height={GRAPH_BAR_H}>
                            <Defs>
                              <LinearGradient id={`rsBar${i}`} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0%"   stopColor={topTheme.line} stopOpacity="0" />
                                <Stop offset="100%" stopColor={topTheme.line} stopOpacity="1" />
                              </LinearGradient>
                            </Defs>
                            <Path
                              d={bottomRoundedRect(0, 0, barW, GRAPH_BAR_H, BAR_RADIUS)}
                              fill={`url(#rsBar${i})`}
                              opacity={isSelected ? 0.5 : 0.05}
                            />
                          </Svg>
                        </Pressable>
                      );
                    })}
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
            {/* ─── Page 3: (내용 추후 추가) ─── */}
            <View style={[styles.page, { height: pageHeight }]} />

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
            label="Finish Race"
            enabled
            onPress={openSheet}
            gradientStart={topTheme.line}
            gradientEnd={topTheme.text}
          />
        </View>
      </Animated.View>

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
  contentArea: {
    flex: 1,
  },
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
