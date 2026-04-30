/**
 * HistoryScreen — 세 번째 탭 (clipboard)
 * 등급 트로피 · 통산 스탯 · 퀄리파잉 트렌드(선택) · 월간 달력 · 그랑프리 히스토리
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLG,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { CIRCUITS } from '../config/circuits';
import { fmtDist, fmtPace } from '../utils/format';
import { fetchQualifyingHistory } from '../api/qualifying';
import { fetchSessions } from '../api/sessions';
import { GRADE_DISPLAY_NAME, GRADE_ORDER } from '../constants/grade';
import type { HistoryScreenProps } from '../navigation/types';
import type { QualifyingGrade } from '../types';
import GradientCardBorder from '../components/GradientCardBorder';
import { useTabBarTotalHeight } from '../components/TabBar';
import { MonthGrid, calcColX, toISO } from '../components/MonthCalendar';

// ─── Assets ──────────────────────────────────────────────────────────────────

const FLAME_ICON = require('../../assets/icons/qualifying-warmup-5ce716.png');

const TROPHY_IMAGES: Record<QualifyingGrade, ReturnType<typeof require>> = {
  f1_champion: require('../../assets/f1-champion.png'),
  f1: require('../../assets/f1.png'),
  f1_rookie: require('../../assets/f1-rookie.png'),
  f2: require('../../assets/f2.png'),
  f3: require('../../assets/f3.png'),
};

const HISTORY_QUAL_IMAGES: Record<QualifyingGrade, ReturnType<typeof require>> = {
  f1_champion: require('../../assets/qualifying/history-f1-champion.png'),
  f1: require('../../assets/qualifying/history-f1.png'),
  f1_rookie: require('../../assets/qualifying/history-f1-rookie.png'),
  f2: require('../../assets/qualifying/history-f2.png'),
  f3: require('../../assets/qualifying/history-f3.png'),
};

const RACER_CARD_IMAGES: Record<string, ReturnType<typeof require>> = {
  'F1 Champion': require('../../assets/racer-card-f1-champion.png'),
  'F1':          require('../../assets/racer-card-f1.png'),
  'F1 Rookie':   require('../../assets/racer-card-f1-rookie.png'),
  'F2':          require('../../assets/racer-card-f2.png'),
  'F3':          require('../../assets/racer-card-f3.png'),
};
const RACER_CARD_H = 26;
const RACER_CARD_W = Math.round(RACER_CARD_H * (393 / 204)); // 50px

// ─── Constants ───────────────────────────────────────────────────────────────

const FIGMA_STATUS = 59;
const SIDE_PAD = 24;
const PACE_AXIS_PAD_MIN_SEC = 2;
const PACE_AXIS_PAD_RATIO = 0.1;
const PACE_AXIS_MIN_SPAN_SEC = 22;

/** 퀄리파잉 기록 3개 이상일 때 트렌드 그래프 표시 */
const QUALIFYING_TREND_MIN = 3;
/** 트렌드 그래프 최대 표시 개수 (최신 순) */
const QUALIFYING_TREND_MAX = 5;

/** 각 등급을 달성하는 데 필요한 최대 페이스(초). f3은 상한 없음 */
const GRADE_PACE_THRESHOLD: Partial<Record<QualifyingGrade, number>> = {
  f1_champion: 240,
  f1:          270,
  f1_rookie:   330,
  f2:          390,
};

/** 각 등급의 바로 위(더 빠른) 등급 */
const GRADE_NEXT: Partial<Record<QualifyingGrade, QualifyingGrade>> = {
  f3:        'f2',
  f2:        'f1_rookie',
  f1_rookie: 'f1',
  f1:        'f1_champion',
};

/** 툴팁 우측 셰브론 */
const TOOLTIP_CHEVRON_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

// ─── Types ───────────────────────────────────────────────────────────────────

type QHistRow = {
  iso: string;
  label: string;
  paceSec: number;
  grade: QualifyingGrade;
  promotedGrade?: string;
};

type HistoryRow =
  | { type: 'grand_prix'; sortKey: string; dateDisplay: string; distKm: number; venue: string; circuitId: string }
  | { type: 'practice';   sortKey: string; dateDisplay: string; distKm: number }
  | { type: 'qualifying'; sortKey: string; dateDisplay: string; distKm: number; grade: QualifyingGrade };

// ─── Fallback demo data ───────────────────────────────────────────────────────

const FALLBACK_QUALIFYING: QHistRow[] = [
  { iso: '2024-03-25', label: '03.25', paceSec: 405, grade: 'f3' },
  { iso: '2024-05-26', label: '05.26', paceSec: 392, grade: 'f3' },
  { iso: '2024-06-30', label: '06.30', paceSec: 383, grade: 'f2', promotedGrade: 'F2' },
  { iso: '2025-01-01', label: '01.01', paceSec: 355, grade: 'f2' },
  { iso: '2025-02-02', label: '02.02', paceSec: 326, grade: 'f1_rookie', promotedGrade: 'F1 Rookie' },
];

const FALLBACK_HISTORY: HistoryRow[] = [
  { type: 'grand_prix', sortKey: '2023-01-26', dateDisplay: '26.01.23', venue: 'MONACO', distKm: 5.14, circuitId: 'monaco' },
  { type: 'qualifying', sortKey: '2023-01-20', dateDisplay: '20.01.23', distKm: 4.55, grade: 'f2' },
  { type: 'practice',   sortKey: '2023-01-15', dateDisplay: '15.01.23', distKm: 3.21 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _histGradSeq = 0;

function paceToY(paceSec: number, minP: number, maxP: number, plotTop: number, plotH: number): number {
  if (maxP <= minP) return plotTop + plotH / 2;
  const t = (paceSec - minP) / (maxP - minP);
  return plotTop + t * plotH;
}

function computePaceAxisMinMax(paces: number[]): { minP: number; maxP: number } {
  if (paces.length === 0) return { minP: 270, maxP: 390 };
  const vMin = Math.min(...paces);
  const vMax = Math.max(...paces);
  const span = Math.max(vMax - vMin, 1e-6);
  const pad = Math.max(PACE_AXIS_PAD_MIN_SEC, span * PACE_AXIS_PAD_RATIO);
  let minP = vMin - pad;
  let maxP = vMax + pad;
  if (maxP - minP < PACE_AXIS_MIN_SPAN_SEC) {
    const mid = (vMin + vMax) / 2;
    minP = mid - PACE_AXIS_MIN_SPAN_SEC / 2;
    maxP = mid + PACE_AXIS_MIN_SPAN_SEC / 2;
  }
  minP = Math.min(minP, vMin);
  maxP = Math.max(maxP, vMax);
  if (maxP - minP < PACE_AXIS_MIN_SPAN_SEC) {
    const extra = PACE_AXIS_MIN_SPAN_SEC - (maxP - minP);
    minP -= extra / 2;
    maxP += extra / 2;
  }
  return { minP, maxP };
}

function smoothLinePath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return '';
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`;
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  return d;
}

// ─── HistoryScreen ───────────────────────────────────────────────────────────

export default function HistoryScreen({ navigation }: HistoryScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const tabH = useTabBarTotalHeight();
  const { isAuthenticated } = useAuthStore();

  const py = (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS);

  // 콘텐츠 폭 (좌우 24px 패딩)
  const contentW = windowW - SIDE_PAD * 2;

  // ─── Store ────────────────────────────────────────────────────────────────
  const totalDistanceKm = useAppStore((s) => s.totalDistanceKm);
  const activityDates = useAppStore((s) => s.activityDates);
  const qualifyingDates = useAppStore((s) => s.qualifyingDates);
  const qualifyingResult = useAppStore((s) => s.qualifyingResult);

  // ─── Derived values ───────────────────────────────────────────────────────
  const distKmDisplay = totalDistanceKm > 0 ? totalDistanceKm : 23.14;
  const onTrackDays = activityDates.length;

  const todayISO = useMemo(() => toISO(new Date()), []);
  const activitySet = useMemo(() => new Set(activityDates), [activityDates]);
  const qualifyingSet = useMemo(() => new Set(qualifyingDates), [qualifyingDates]);

  // 달력 월 offset (0 = 이번 달)
  const [monthOffset, setMonthOffset] = useState(0);

  // 달력 colX 계산
  const [calCardW, setCalCardW] = useState(windowW - SIDE_PAD * 2);
  const calColX = useMemo(() => calcColX(calCardW), [calCardW]);

  // ─── Supabase 데이터 fetch ────────────────────────────────────────────────
  const [qualifyingData, setQualifyingData] = useState<QHistRow[]>(FALLBACK_QUALIFYING);
  const [historyData, setHistoryData] = useState<HistoryRow[]>(FALLBACK_HISTORY);
  const [thisMonthDistKm, setThisMonthDistKm] = useState(32.2);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;

      (async () => {
        try {
          const rows = await fetchQualifyingHistory();
          if (rows.length > 0) {
            const sorted = [...rows].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
            let prevGrade: QualifyingGrade | null = null;
            const mapped: QHistRow[] = sorted.map((r) => {
              const d = new Date(r.recorded_at);
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const isPromotion = prevGrade != null &&
                GRADE_ORDER.indexOf(r.grade) < GRADE_ORDER.indexOf(prevGrade);
              const promoted = isPromotion ? GRADE_DISPLAY_NAME[r.grade] : undefined;
              prevGrade = r.grade;
              return {
                iso: r.recorded_at.slice(0, 10),
                label: `${mm}.${dd}`,
                paceSec: r.pace_sec_per_km,
                grade: r.grade,
                promotedGrade: promoted,
              };
            });
            setQualifyingData(mapped);
            setSelectedIdx(mapped.length - 1);
          }
        } catch (e) {
          console.warn('[HistoryScreen] qualifying fetch error:', e);
        }

        try {
          const [sessions, qualRows] = await Promise.all([
            fetchSessions(200),
            fetchQualifyingHistory(),
          ]);

          // qualifying 결과를 날짜(iso)로 빠르게 조회할 수 있도록 map 구성
          const qualByDate = new Map<string, QualifyingGrade>();
          for (const q of qualRows) {
            qualByDate.set(q.recorded_at.slice(0, 10), q.grade);
          }

          // 이번 달 달린 거리 계산
          const now = new Date();
          const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const monthDist = sessions
            .filter((s) => s.status === 'completed' && s.started_at.slice(0, 7) === thisMonth)
            .reduce((sum, s) => sum + (s.total_dist_km ?? 0), 0);
          if (monthDist > 0) setThisMonthDistKm(monthDist);

          // 완료된 세션 → HistoryRow 변환
          const completed = sessions.filter((s) => s.status === 'completed');
          if (completed.length > 0) {
            const mapped: HistoryRow[] = completed.map((s) => {
              const d = new Date(s.started_at);
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yy = String(d.getFullYear()).slice(2);
              const sortKey = s.started_at.slice(0, 10);
              const dateDisplay = `${dd}.${mm}.${yy}`;
              const distKm = s.total_dist_km ?? 0;

              if (s.type === 'grand_prix') {
                const circuit = CIRCUITS.find((c) => c.id === s.circuit_id);
                return {
                  type: 'grand_prix',
                  sortKey,
                  dateDisplay,
                  distKm,
                  venue: circuit?.displayName?.toUpperCase() ?? s.circuit_id?.toUpperCase() ?? 'UNKNOWN',
                  circuitId: s.circuit_id ?? 'monaco',
                };
              } else if (s.type === 'qualifying') {
                const grade = qualByDate.get(sortKey) ?? 'f3';
                return { type: 'qualifying', sortKey, dateDisplay, distKm, grade };
              } else {
                return { type: 'practice', sortKey, dateDisplay, distKm };
              }
            });
            setHistoryData(mapped);
          }
        } catch (e) {
          console.warn('[HistoryScreen] sessions fetch error:', e);
        }
      })();
    }, [isAuthenticated]),
  );

  // ─── Qualifying trend chart data ──────────────────────────────────────────
  const sortedQ = useMemo(
    () => [...qualifyingData].sort((a, b) => a.iso.localeCompare(b.iso)),
    [qualifyingData],
  );
  const showTrend = sortedQ.length >= QUALIFYING_TREND_MIN;

  const visible = useMemo(
    () => sortedQ.slice(Math.max(0, sortedQ.length - QUALIFYING_TREND_MAX)),
    [sortedQ],
  );

  const [selectedIdx, setSelectedIdx] = useState(() =>
    visible.length ? visible.length - 1 : 0,
  );

  const barH = 138;
  const plotH = 78;
  const plotTopInBlock = 28;

  const currentGrade = qualifyingResult?.grade ?? 'f2';

  const nextGrade = GRADE_NEXT[currentGrade] ?? null;

  type ThresholdLine = { grade: QualifyingGrade; y: number; isNext: boolean };

  const { linePath, areaPath, thresholdLines, dotXs, dotYs } = useMemo(() => {
    const fallback = {
      linePath: '', areaPath: '',
      thresholdLines: [] as ThresholdLine[],
      dotXs: [] as number[], dotYs: [] as number[],
    };
    if (visible.length === 0) return fallback;
    const paces = visible.map((v) => v.paceSec);
    const { minP, maxP } = computePaceAxisMinMax(paces);
    const n = visible.length;
    const ys = visible.map((v) => paceToY(v.paceSec, minP, maxP, plotTopInBlock, plotH));
    // dot/실선/텍스트: 텍스트 left=20, right=windowW-20이 되도록 중심을 52~windowW-52에 배치
    const dotL = 52;
    const dotR = windowW - 52;
    const xs = n <= 1
      ? [windowW / 2]
      : visible.map((_, i) => dotL + (i / (n - 1)) * (dotR - dotL));
    // curve/area는 좌우 20px 마진까지 수평 연장 (xs[0]=왼쪽 oldest, xs[n-1]=오른쪽 newest)
    const cxs = n <= 1 ? [20, xs[0], windowW - 20] : [20, ...xs, windowW - 20];
    const cys = n <= 1 ? [ys[0], ys[0], ys[0]] : [ys[0], ...ys, ys[ys.length - 1]];
    const lp = smoothLinePath(cxs, cys);
    const baseY = barH - 2;
    const ap = `${lp} L ${windowW - 20} ${baseY} L 20 ${baseY} Z`;
    const inRange = (sec: number) => sec >= minP && sec <= maxP;
    // visible 내 승급 이벤트 등급 + 다음 목표 등급 threshold를 모두 수집
    const gradesToShow = new Set<QualifyingGrade>();
    visible.forEach((v) => { if (v.promotedGrade) gradesToShow.add(v.grade); });
    if (nextGrade) gradesToShow.add(nextGrade);
    const lines: ThresholdLine[] = [];
    gradesToShow.forEach((grade) => {
      const sec = GRADE_PACE_THRESHOLD[grade];
      if (sec == null || !inRange(sec)) return;
      lines.push({ grade, y: paceToY(sec, minP, maxP, plotTopInBlock, plotH), isNext: grade === nextGrade });
    });
    return { linePath: lp, areaPath: ap, thresholdLines: lines, dotXs: xs, dotYs: ys };
  }, [visible, windowW, plotH, plotTopInBlock, barH, nextGrade]);

  const gradPrefix = useRef(`qhG_${++_histGradSeq}`).current;

  const selected = visible[selectedIdx];
  const selDotX = dotXs[selectedIdx] ?? windowW / 2;
  const selDotY = dotYs[selectedIdx] ?? plotTopInBlock + plotH / 2;
  const bubbleCenterX = selDotX;

  const [tooltipWrapW, setTooltipWrapW] = useState(0);
  const tooltipWrapClamped = tooltipWrapW > 0 ? tooltipWrapW : 160;
  const tooltipWrapLeft = Math.max(
    SIDE_PAD,
    Math.min(windowW - 20 - tooltipWrapClamped, bubbleCenterX - tooltipWrapClamped / 2),
  );
  // RN alignItems:'center' + marginLeft은 margin box 기준 센터링 → 2*(offset) - P 로 보정
  const tooltipTailShift = 2 * (selDotX - tooltipWrapLeft) - tooltipWrapClamped;

  // ─── Pill animation (Reanimated spring, bottom-to-top) ────────────────────
  const pillRevealH = useSharedValue(barH);
  useEffect(() => {
    pillRevealH.value = 0;
    pillRevealH.value = withTiming(barH, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [selectedIdx, barH, pillRevealH]);
  const pillRevealStyle = useAnimatedStyle(() => ({ height: pillRevealH.value }));

  // ─── Tooltip x-slide (RN Animated spring) ────────────────────────────────
  const tooltipXAnim = useRef(new Animated.Value(tooltipWrapLeft)).current;
  const tooltipXMountedRef = useRef(false);
  useEffect(() => {
    if (!tooltipXMountedRef.current) {
      tooltipXAnim.setValue(tooltipWrapLeft);
      tooltipXMountedRef.current = true;
      return;
    }
    Animated.spring(tooltipXAnim, {
      toValue: tooltipWrapLeft,
      useNativeDriver: false,
      tension: 180,
      friction: 26,
    }).start();
  }, [tooltipWrapLeft, tooltipXAnim]);

  // ─── Tooltip cross-fade (promotedGrade 유무 전환 시) ───────────────────────
  const tooltipFadeAnim = useRef(new Animated.Value(1)).current;
  const [shownIdx, setShownIdx] = useState(selectedIdx);
  const prevHasGradeRef = useRef(!!selected?.promotedGrade);
  useEffect(() => {
    const hasGrade = !!visible[selectedIdx]?.promotedGrade;
    if (hasGrade !== prevHasGradeRef.current) {
      prevHasGradeRef.current = hasGrade;
      Animated.timing(tooltipFadeAnim, { toValue: 0, duration: 80, useNativeDriver: true }).start(() => {
        setShownIdx(selectedIdx);
        Animated.timing(tooltipFadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      });
    } else {
      setShownIdx(selectedIdx);
    }
  }, [selectedIdx, visible, tooltipFadeAnim]);

  // ─── History cards ────────────────────────────────────────────────────────
  const historySorted = useMemo(
    () => [...historyData].sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
    [historyData],
  );

  // ─── Trophy ───────────────────────────────────────────────────────────────
  const trophySource = qualifyingResult
    ? TROPHY_IMAGES[qualifyingResult.grade]
    : TROPHY_IMAGES['f2'];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#17171C' }]}>
      <BlurView
        intensity={60}
        tint="dark"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop, zIndex: 1000 }}
        pointerEvents="none"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabH + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. 등급 트로피 ── */}
        <Image
          source={trophySource}
          style={[s.trophy, { marginTop: safeTop + 64, marginLeft: 20 }]}
          resizeMode="contain"
        />

        {/* ── 2~3. TOTAL + ON TRACK 스탯 ── */}
        <View style={[s.statsRow, { marginTop: 32, marginLeft: 20 }]}>
          {/* TOTAL */}
          <View style={s.statGroup}>
            <Text style={s.statLabel}>TOTAL</Text>
            <View style={[s.statValueRow, { marginTop: 8 }]}>
              <Text style={s.statNum}>{fmtDist(distKmDisplay)}</Text>
              <Text style={s.statUnit}>km</Text>
            </View>
          </View>

          {/* ON TRACK */}
          <View style={[s.statGroup, { marginLeft: 52 }]}>
            <Text style={s.statLabel}>ON TRACK</Text>
            <View style={[s.statValueRow, { marginTop: 8 }]}>
              <Text style={s.statNum}>{onTrackDays}</Text>
              <Text style={s.statUnit}>days</Text>
            </View>
          </View>
        </View>

        {/* ── 4. 퀄리파잉 트렌드 (3개 이상일 때만) ── */}
        {showTrend && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 72, marginLeft: 20 }]}>
              Qualifying Trend
            </Text>

            {/* 그래프 영역: 높이 238 */}
            <View style={{ width: windowW, marginTop: 12, height: 238 }}>
              {selected && (() => {
                const shownSelected = visible[shownIdx] ?? selected;
                const shownTailShift = 2 * (selDotX - tooltipWrapLeft) - tooltipWrapClamped;
                return (
                  <Animated.View
                    style={[s.tooltipWrap, { left: tooltipXAnim, top: 0 }]}
                    onLayout={(e) => setTooltipWrapW(e.nativeEvent.layout.width)}
                  >
                    <View style={s.tooltipColumn}>
                      <Animated.View style={[s.tooltipBubble, { opacity: tooltipFadeAnim }]}>
                        {shownSelected.promotedGrade && RACER_CARD_IMAGES[shownSelected.promotedGrade] ? (
                          <Image
                            source={RACER_CARD_IMAGES[shownSelected.promotedGrade]}
                            style={{ width: RACER_CARD_W, height: RACER_CARD_H, marginRight: 6 }}
                            resizeMode="contain"
                          />
                        ) : null}
                        <Text style={s.tooltipPace}>{fmtPace(shownSelected.paceSec)}</Text>
                      </Animated.View>
                      <Svg width={14} height={10} viewBox="0 0 14 10" style={[s.tooltipTailSvg, { marginLeft: shownTailShift }]}>
                        <Path
                          d="M 0 0 H 14 L 9.42 6.05 A 3 3 0 0 1 4.58 6.05 L 0 0 Z"
                          fill="rgba(224,58,62,0.15)"
                        />
                      </Svg>
                    </View>
                  </Animated.View>
                );
              })()}

              <View
                style={{
                  width: windowW,
                  marginTop: 56,
                  height: barH + 28,
                  position: 'relative',
                }}
              >
                {/* SVG: area + thresholds + curve + selected indicator (windowW 전체 폭) */}
                <View
                  style={{ position: 'absolute', left: 0, top: 0, width: windowW, height: barH }}
                  pointerEvents="none"
                >
                  <Svg width={windowW} height={barH} viewBox={`0 0 ${windowW} ${barH}`}>
                    <Defs>
                      <SvgLG id={`${gradPrefix}_area`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#E03A3E" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0" />
                      </SvgLG>
                      <SvgLG
                        id={`${gradPrefix}_line`}
                        x1={20} y1="0" x2={windowW - 20} y2="0"
                        gradientUnits="userSpaceOnUse"
                      >
                        <Stop offset="0%" stopColor="#E03A3E" stopOpacity="0" />
                        <Stop offset="15%" stopColor="#E03A3E" stopOpacity="1" />
                        <Stop offset="85%" stopColor="#E03A3E" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0" />
                      </SvgLG>
                      {/* 컬럼 인디케이터 그라디언트: 상단 opacity 0 → 하단 opacity 0.5 */}
                      <SvgLG id={`${gradPrefix}_col`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#E03A3E" stopOpacity="0" />
                        <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0.5" />
                      </SvgLG>
                      {/* 좌우 fade: 배경색으로 curve/그라데이션 가장자리를 자연스럽게 소멸 */}
                      <SvgLG id={`${gradPrefix}_fadeL`} x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0%" stopColor="#17171C" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#17171C" stopOpacity="0" />
                      </SvgLG>
                      <SvgLG id={`${gradPrefix}_fadeR`} x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0%" stopColor="#17171C" stopOpacity="0" />
                        <Stop offset="100%" stopColor="#17171C" stopOpacity="1" />
                      </SvgLG>
                    </Defs>
                    {/* Area fill */}
                    {areaPath ? (
                      <Path d={areaPath} fill={`url(#${gradPrefix}_area)`} opacity={0.2} />
                    ) : null}
                    {/* threshold 점선 — visible 내 승급 등급 + 다음 목표 등급 */}
                    {thresholdLines.map((tl) => (
                      <Path
                        key={tl.grade}
                        d={`M 20 ${tl.y} L ${windowW - 20} ${tl.y}`}
                        stroke="#E03A3E" strokeWidth={1} strokeDasharray="4, 4" fill="none"
                        opacity={tl.isNext ? 1 : 0.5}
                      />
                    ))}
                    {/* 미선택 컬럼: width 1 세로 stroke */}
                    {dotXs.map((cx, i) => i === selectedIdx ? null : (
                      <Rect
                        key={`col_u_${i}`}
                        x={cx - 0.5} y={0}
                        width={1} height={barH}
                        fill={`url(#${gradPrefix}_col)`}
                      />
                    ))}
                    {/* 선택 컬럼은 SVG 밖 native View로 이동 (Reanimated 애니메이션) */}
                    {/* Curve line */}
                    {linePath ? (
                      <Path
                        d={linePath}
                        stroke={`url(#${gradPrefix}_line)`}
                        strokeWidth={4}
                        fill="none"
                      />
                    ) : null}
                    {/* Selected dot — 22×22, inside stroke 4px #17171C */}
                    <Circle
                      cx={selDotX} cy={selDotY}
                      r={9} fill="#E03A3E" stroke="#17171C" strokeWidth={4}
                    />
                    {/* 좌우 fade 오버레이: curve 시작/끝 20px을 배경색으로 소멸 */}
                    <Rect x={20} y={0} width={20} height={barH} fill={`url(#${gradPrefix}_fadeL)`} />
                    <Rect x={windowW - 40} y={0} width={20} height={barH} fill={`url(#${gradPrefix}_fadeR)`} />
                  </Svg>
                  {/* threshold 라벨 */}
                  {thresholdLines.map((tl) => {
                    const sec = GRADE_PACE_THRESHOLD[tl.grade]!;
                    const top = tl.isNext ? Math.max(0, tl.y - 18) : Math.min(barH - 18, tl.y - 18);
                    return (
                      <Text key={tl.grade} style={[s.thresholdLabel, { left: 22, top, opacity: tl.isNext ? 1 : 0.5 }]}>
                        {`${GRADE_DISPLAY_NAME[tl.grade]} ${fmtPace(sec)}`}
                      </Text>
                    );
                  })}
                  {/* 선택 pill: Reanimated spring, bottom-to-top reveal */}
                  <View
                    style={{
                      position: 'absolute',
                      left: selDotX - 6,
                      top: 0,
                      width: 12,
                      height: barH,
                      borderRadius: 6,
                      overflow: 'hidden',
                      justifyContent: 'flex-end',
                    }}
                    pointerEvents="none"
                  >
                    <Reanimated.View style={[{ width: 12, overflow: 'hidden' }, pillRevealStyle]}>
                      <LinearGradient
                        colors={['rgba(224,58,62,0)', 'rgba(224,58,62,0.5)']}
                        style={{ width: 12, height: barH }}
                      />
                    </Reanimated.View>
                  </View>
                </View>

                {/* Invisible pressable zones per data point */}
                {visible.map((row, i) => {
                  const cx = dotXs[i] ?? windowW / 2;
                  const n = visible.length;
                  const half = n <= 1 ? windowW / 2 : (windowW - 104) / (2 * (n - 1));
                  const left = Math.max(0, cx - half);
                  const right = Math.min(windowW, cx + half);
                  return (
                    <Pressable
                      key={row.iso}
                      onPress={() => setSelectedIdx(i)}
                      style={{ position: 'absolute', left, top: 0, width: right - left, height: barH }}
                    />
                  );
                })}

                {/* Date labels: 모든 텍스트 cx 기준 center-align, 세로 실선과 중앙 정렬 */}
                {visible.map((row, i) => {
                  const cx = dotXs[i] ?? windowW / 2;
                  return (
                    <Text
                      key={row.iso + '_lbl'}
                      style={[s.colDate, { position: 'absolute', top: barH + 8, left: cx - 32, width: 64 }]}
                    >
                      {row.label}
                    </Text>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ── 5. 이번 달 불 아이콘 그룹 ── */}
        <View style={[s.flameGroup, { marginTop: 52, marginLeft: SIDE_PAD }]}>
          <Image source={FLAME_ICON} style={s.flameIcon} resizeMode="contain" />
          <View style={s.flameTextCol}>
            <Text style={s.flameLabel}>THIS MONTH</Text>
            <View style={s.flameValueRow}>
              <Text style={s.flameNum}>{fmtDist(thisMonthDistKm)}</Text>
              <Text style={s.flameUnit}>km</Text>
            </View>
          </View>
        </View>

        {/* ── 6. 월간 달력 ── */}
        <View
          style={{ marginTop: 16, marginHorizontal: SIDE_PAD, height: 292 }}
          onLayout={(e) => setCalCardW(e.nativeEvent.layout.width)}
        >
          <MonthGrid
            today={todayISO}
            activitySet={activitySet}
            qualifyingSet={qualifyingSet}
            colX={calColX}
            monthOffset={monthOffset}
            onPrev={() => setMonthOffset((o) => o - 1)}
            onNext={() => setMonthOffset((o) => o + 1)}
          />
        </View>

        {/* ── 8. History 섹션 타이틀 ── */}
        <Text style={[s.sectionTitle, { marginTop: 48, marginLeft: SIDE_PAD }]}>History</Text>

        {/* ── 9. 레이스 카드 ── */}
        <View style={{ marginHorizontal: SIDE_PAD, marginTop: 12, gap: 12 }}>
          {historySorted.map((row) => {
            if (row.type === 'grand_prix' || row.type === 'practice') {
              return (
                <GradientCardBorder
                  key={row.sortKey}
                  style={s.gpCardOuter}
                  innerStyle={s.gpCardInner}
                  borderRadius={16}
                >
                  <View style={s.gpTextCol}>
                    <Text style={s.gpDate}>{row.dateDisplay}</Text>
                    <Text style={s.gpVenue}>
                      {row.type === 'grand_prix' ? row.venue : 'Practice'}
                    </Text>
                  </View>
                  <View style={s.gpDistRow}>
                    <Text style={s.gpDist}>{fmtDist(row.distKm)}</Text>
                    <Text style={s.gpDistUnit}>km</Text>
                  </View>
                </GradientCardBorder>
              );
            }

            // qualifying
            return (
              <GradientCardBorder
                key={row.sortKey}
                style={s.gpCardOuter}
                innerStyle={s.gpCardInner}
                borderRadius={16}
              >
                <View style={s.gpTextCol}>
                  <Text style={s.gpDate}>{row.dateDisplay}</Text>
                  <Text style={s.gpVenue}>Qualifying</Text>
                </View>
                <Image
                  source={HISTORY_QUAL_IMAGES[row.grade]}
                  style={s.gpQualImg}
                  resizeMode="contain"
                />
              </GradientCardBorder>
            );
          })}
        </View>
      </ScrollView>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── 트로피 ──
  trophy: {
    height: 42,
    aspectRatio: 630 / 220,
  },

  // ── TOTAL / ON TRACK 스탯 ──
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statGroup: {
    flexDirection: 'column',
  },
  statLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.02 * 13,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statNum: {
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.02 * 30,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  statUnit: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.02 * 17,
    color: '#FFFFFF',
    includeFontPadding: false,
  },

  // ── 불 아이콘 그룹 ──
  flameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flameIcon: {
    width: 36,
    height: 43,
  },
  flameTextCol: {
    marginLeft: 12,
    flexDirection: 'column',
  },
  flameLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.02 * 13,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  flameValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  flameNum: {
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.02 * 24,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  flameUnit: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.02 * 17,
    color: '#FFFFFF',
    includeFontPadding: false,
  },

  // ── 섹션 타이틀 ──
  sectionTitle: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.02 * 17,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },

  // ── 퀄리파잉 트렌드 그래프 ──
  tooltipWrap: {
    position: 'absolute',
    zIndex: 20,
  },
  tooltipColumn: {
    alignItems: 'center',
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 7,
    backgroundColor: 'rgba(224,58,62,0.15)',
    borderRadius: 12,
  },
  tooltipTailSvg: {
    marginTop: 0,
  },
  tooltipPace: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.01 * 20,
    fontStyle: 'italic',
    color: '#FFFFFF',
    opacity: 0.7,
  },
  colDate: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    textAlign: 'center',
    color: '#E03A3E',
    opacity: 0.5,
  },
  thresholdLabel: {
    position: 'absolute',
    left: 0,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: '#E03A3E',
  },

  // ── GP 카드 ──
  gpCardOuter: {
    borderRadius: 16,
  },
  gpCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 20,
    paddingVertical: 20,
  },
  gpTextCol: {
    flex: 1,
  },
  gpDate: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.02 * 13,
    color: '#FFFFFF',
    opacity: 0.5,
    marginBottom: 4,
  },
  gpVenue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.02 * 17,
    color: '#FFFFFF',
  },
  gpDistRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  gpDist: {
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.02 * 30,
    color: '#FFFFFF',
  },
  gpDistUnit: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.02 * 17,
    color: '#FFFFFF',
  },
  gpQualImg: {
    width: 54,
    height: 54,
  },
});
