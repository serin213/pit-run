/**
 * HistoryScreen — 세 번째 탭 (clipboard)
 * 등급 트로피 · 통산 스탯 · 퀄리파잉 트렌드(선택) · 월간 달력 · 그랑프리 히스토리
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Defs,
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
import { GRADE_DISPLAY_NAME } from '../constants/grade';
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

/** 레이서 카드(프로필)와 동일 F2 등급 배지 */
const GRADE_F2_BADGE = require('../../assets/grade-f2.png') as ReturnType<typeof require>;

// ─── Constants ───────────────────────────────────────────────────────────────

const FIGMA_STATUS = 59;
const SIDE_PAD = 24;
const COL_MIN_W = 65;
const COL_GAP = 5;
const GRADE_BADGE_H = 24;
const GRADE_BADGE_W = Math.round((58 / 29) * GRADE_BADGE_H);
/** 다음 등급(F1) 기준 1km 페이스(초) — 트렌드 그래프 점선 */
const THRESHOLD_SEC = 5 * 60;
const PACE_AXIS_PAD_MIN_SEC = 2;
const PACE_AXIS_PAD_RATIO = 0.1;
const PACE_AXIS_MIN_SPAN_SEC = 22;

/** 퀄리파잉 기록 3개 이상일 때 트렌드 그래프 표시 */
const QUALIFYING_TREND_MIN = 3;

/** 툴팁 우측 셰브론 */
const TOOLTIP_CHEVRON_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

// ─── Types ───────────────────────────────────────────────────────────────────

type QHistRow = {
  iso: string;
  label: string;
  paceSec: number;
  promotedGrade?: string;
};

type HistoryRow =
  | { type: 'grand_prix'; sortKey: string; dateDisplay: string; distKm: number; venue: string; circuitId: string }
  | { type: 'practice';   sortKey: string; dateDisplay: string; distKm: number }
  | { type: 'qualifying'; sortKey: string; dateDisplay: string; distKm: number; grade: QualifyingGrade };

// ─── Fallback demo data ───────────────────────────────────────────────────────

const FALLBACK_QUALIFYING: QHistRow[] = [
  { iso: '2024-03-25', label: '03.25', paceSec: 318 },
  { iso: '2024-05-26', label: '05.26', paceSec: 312 },
  { iso: '2024-06-30', label: '06.31', paceSec: 329, promotedGrade: 'F2' },
  { iso: '2025-01-01', label: '01.01', paceSec: 315 },
  { iso: '2025-02-02', label: '02.02', paceSec: 308 },
];

const FALLBACK_HISTORY: HistoryRow[] = [
  { type: 'grand_prix', sortKey: '2023-01-26', dateDisplay: '26.01.23', venue: 'MONACO', distKm: 5.14, circuitId: 'monaco' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _histGradSeq = 0;

function maxFitColumns(contentW: number, gap: number): number {
  let k = 0;
  while (k * COL_MIN_W + Math.max(0, k - 1) * gap <= contentW) k++;
  return Math.max(1, k - 1);
}

function paceToY(paceSec: number, minP: number, maxP: number, plotTop: number, plotH: number): number {
  if (maxP <= minP) return plotTop + plotH / 2;
  const t = (paceSec - minP) / (maxP - minP);
  return plotTop + (1 - t) * plotH;
}

function computePaceAxisMinMax(paces: number[], thresholdSec: number): { minP: number; maxP: number } {
  if (paces.length === 0) {
    return { minP: thresholdSec - 30, maxP: thresholdSec + 30 };
  }
  const vMin = Math.min(thresholdSec, ...paces);
  const vMax = Math.max(thresholdSec, ...paces);
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
  const qualifyingResult = useAppStore((s) => s.qualifyingResult);

  // ─── Derived values ───────────────────────────────────────────────────────
  const distKmDisplay = totalDistanceKm > 0 ? totalDistanceKm : 23.14;
  const onTrackDays = activityDates.length;

  const todayISO = useMemo(() => toISO(new Date()), []);
  const activitySet = useMemo(() => new Set(activityDates), [activityDates]);

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
            let prevGrade: string | null = null;
            const mapped: QHistRow[] = sorted.map((r) => {
              const d = new Date(r.recorded_at);
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const promoted =
                prevGrade && r.grade !== prevGrade ? GRADE_DISPLAY_NAME[r.grade] : undefined;
              prevGrade = r.grade;
              return {
                iso: r.recorded_at.slice(0, 10),
                label: `${mm}.${dd}`,
                paceSec: r.pace_sec_per_km,
                promotedGrade: promoted,
              };
            });
            setQualifyingData(mapped);
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

  const maxCols = useMemo(() => maxFitColumns(contentW, COL_GAP), [contentW]);
  const visibleCount = Math.min(sortedQ.length, maxCols);
  const visible = useMemo(
    () => sortedQ.slice(sortedQ.length - visibleCount),
    [sortedQ, visibleCount],
  );

  const colW =
    visible.length > 0
      ? (contentW - (visible.length - 1) * COL_GAP) / visible.length
      : 0;

  const [selectedIdx, setSelectedIdx] = useState(() =>
    visible.length ? Math.min(Math.floor((visible.length - 1) / 2), visible.length - 1) : 0,
  );

  const colAreaH = 166;
  const barH = colAreaH - 28;
  const plotH = 78;
  const plotTopInBlock = 28;

  const { linePath, areaPath, thresholdY } = useMemo(() => {
    if (visible.length === 0) {
      return { linePath: '', areaPath: '', thresholdY: plotTopInBlock + plotH / 2 };
    }
    const paces = visible.map((v) => v.paceSec);
    const { minP, maxP } = computePaceAxisMinMax(paces, THRESHOLD_SEC);
    const n = visible.length;
    const xs =
      n <= 1
        ? [contentW / 2]
        : visible.map((_, i) => (i / (n - 1)) * contentW);
    const ys = visible.map((v) => paceToY(v.paceSec, minP, maxP, plotTopInBlock, plotH));
    const lp = smoothLinePath(xs, ys);
    const lastX = xs[xs.length - 1];
    const firstX = xs[0];
    const baseY = barH - 2;
    const ap = visible.length > 0 ? `${lp} L ${lastX} ${baseY} L ${firstX} ${baseY} Z` : '';
    const ty = paceToY(THRESHOLD_SEC, minP, maxP, plotTopInBlock, plotH);
    return { linePath: lp, areaPath: ap, thresholdY: ty };
  }, [visible, contentW, plotH, plotTopInBlock, barH]);

  const gradPrefix = useRef(`qhG_${++_histGradSeq}`).current;

  const selected = visible[selectedIdx];
  const bubbleCenterX = SIDE_PAD + selectedIdx * (colW + COL_GAP) + colW / 2;

  const [tooltipWrapW, setTooltipWrapW] = useState(0);
  const tooltipWrapClamped = tooltipWrapW > 0 ? tooltipWrapW : 160;
  const tooltipWrapLeft = Math.max(
    SIDE_PAD,
    Math.min(windowW - SIDE_PAD - tooltipWrapClamped, bubbleCenterX - tooltipWrapClamped / 2),
  );

  // ─── History cards ────────────────────────────────────────────────────────
  const historySorted = useMemo(
    () => [...historyData].sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
    [historyData],
  );

  const circuitTargetH = 65;

  const getCircuitInfo = useCallback((circuitId: string) => {
    const circuit = CIRCUITS.find((c) => c.id === circuitId) ?? CIRCUITS[0];
    const vb = circuit.viewBox ?? { width: 337, height: 139 };
    const scale = circuitTargetH / vb.height;
    return { circuit, vb, drawW: vb.width * scale };
  }, []);

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
          style={[s.trophy, { marginTop: safeTop + 90, marginLeft: 20 }]}
          resizeMode="contain"
        />

        {/* ── 2~3. TOTAL + ON TRACK 스탯 ── */}
        <View style={[s.statsRow, { marginTop: 36, marginLeft: 20 }]}>
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
              {selected && (
                <View
                  style={[s.tooltipWrap, { left: tooltipWrapLeft, top: 0 }]}
                  onLayout={(e) => setTooltipWrapW(e.nativeEvent.layout.width)}
                >
                  <View style={s.tooltipColumn}>
                    <View style={s.tooltipBubble}>
                      {selected.promotedGrade ? (
                        <Image
                          source={GRADE_F2_BADGE}
                          style={{ width: GRADE_BADGE_W, height: GRADE_BADGE_H, marginRight: 6 }}
                          resizeMode="contain"
                        />
                      ) : null}
                      <Text style={s.tooltipPace}>{fmtPace(selected.paceSec)}</Text>
                      <Svg width={7} height={13} viewBox="0 0 10 16" style={{ marginLeft: 8 }}>
                        <Path
                          d={TOOLTIP_CHEVRON_PATH}
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </Svg>
                    </View>
                    <Svg width={14} height={10} viewBox="0 0 14 10" style={s.tooltipTailSvg}>
                      <Path
                        d="M 0 0 H 14 L 9.42 6.05 A 3 3 0 0 1 4.58 6.05 L 0 0 Z"
                        fill="rgba(255,255,255,0.1)"
                      />
                    </Svg>
                  </View>
                </View>
              )}

              <View
                style={{
                  marginLeft: SIDE_PAD,
                  width: contentW,
                  marginTop: 56,
                  height: colAreaH,
                  position: 'relative',
                }}
              >
                <View style={{ flexDirection: 'row', height: barH, width: contentW }}>
                  {visible.map((row, i) => (
                    <Pressable
                      key={row.iso}
                      onPress={() => setSelectedIdx(i)}
                      style={{ width: colW, marginRight: i < visible.length - 1 ? COL_GAP : 0 }}
                    >
                      <View style={{ height: barH, borderRadius: 8, overflow: 'hidden' }}>
                        <Svg width={colW} height={barH} viewBox={`0 0 ${colW} ${barH}`}>
                          <Defs>
                            <SvgLG id={`${gradPrefix}_c${i}`} x1="0" y1="0" x2="0" y2="1">
                              <Stop offset="0%" stopColor="#E03A3E" stopOpacity="0" />
                              <Stop offset="100%" stopColor="#E03A3E" stopOpacity="1" />
                            </SvgLG>
                          </Defs>
                          <Rect
                            x="0" y="0"
                            width={colW} height={barH}
                            rx={8}
                            fill={`url(#${gradPrefix}_c${i})`}
                            opacity={selectedIdx === i ? 0.5 : 0.1}
                          />
                        </Svg>
                      </View>
                      <Text style={s.colDate}>{row.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View
                  style={{ position: 'absolute', left: 0, top: 0, width: contentW, height: barH }}
                  pointerEvents="none"
                >
                  <Svg width={contentW} height={barH} viewBox={`0 0 ${contentW} ${barH}`}>
                    <Defs>
                      <SvgLG id={`${gradPrefix}_area`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#E03A3E" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0" />
                      </SvgLG>
                      <SvgLG
                        id={`${gradPrefix}_line`}
                        x1="0" y1="0" x2={contentW} y2="0"
                        gradientUnits="userSpaceOnUse"
                      >
                        <Stop offset="0%" stopColor="#E03A3E" stopOpacity="0" />
                        <Stop offset="10%" stopColor="#E03A3E" stopOpacity="1" />
                        <Stop offset="90%" stopColor="#E03A3E" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0" />
                      </SvgLG>
                    </Defs>
                    {areaPath ? (
                      <Path d={areaPath} fill={`url(#${gradPrefix}_area)`} opacity={0.2} />
                    ) : null}
                    <Path
                      d={`M 0 ${thresholdY} L ${contentW} ${thresholdY}`}
                      stroke="#E03A3E"
                      strokeWidth={1}
                      strokeDasharray="4, 4"
                      fill="none"
                    />
                    {linePath ? (
                      <Path
                        d={linePath}
                        stroke={`url(#${gradPrefix}_line)`}
                        strokeWidth={4}
                        fill="none"
                      />
                    ) : null}
                  </Svg>
                  <Text style={[s.thresholdLabel, { top: Math.max(0, thresholdY - 20) }]}>
                    {`F1 ${fmtPace(THRESHOLD_SEC)}`}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── 5. 이번 달 불 아이콘 그룹 ── */}
        <View style={[s.flameGroup, { marginTop: 72, marginLeft: SIDE_PAD }]}>
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
            colX={calColX}
            monthOffset={monthOffset}
            onPrev={() => setMonthOffset((o) => o - 1)}
            onNext={() => setMonthOffset((o) => o + 1)}
          />
        </View>

        {/* ── 8. History 섹션 타이틀 ── */}
        <Text style={[s.sectionTitle, { marginTop: 72, marginLeft: SIDE_PAD }]}>History</Text>

        {/* ── 9. 레이스 카드 ── */}
        <View style={{ marginHorizontal: SIDE_PAD, marginTop: 12, gap: 12 }}>
          {historySorted.map((row) => {
            if (row.type === 'grand_prix') {
              const { circuit, vb, drawW } = getCircuitInfo(row.circuitId);
              return (
                <GradientCardBorder
                  key={row.sortKey}
                  style={s.gpCardOuter}
                  innerStyle={s.gpCardInner}
                  borderRadius={16}
                >
                  <View style={s.gpTextCol}>
                    <Text style={s.gpDate}>{row.dateDisplay}</Text>
                    <Text style={s.gpVenue}>{row.venue}</Text>
                    <View style={s.gpDistRow}>
                      <Text style={s.gpDist}>{fmtDist(row.distKm)}</Text>
                      <Text style={s.gpDistUnit}>km</Text>
                    </View>
                  </View>
                  <View style={[s.gpCircuitWrap, { minWidth: drawW }]}>
                    <Svg
                      width={drawW}
                      height={circuitTargetH}
                      viewBox={`0 0 ${vb.width} ${vb.height}`}
                      style={s.gpCircuitSvg}
                    >
                      <Path d={circuit.trackPath} stroke="#FFFFFF" strokeWidth={4} fill="none" />
                    </Svg>
                  </View>
                </GradientCardBorder>
              );
            }

            if (row.type === 'practice') {
              return (
                <GradientCardBorder
                  key={row.sortKey}
                  style={s.gpCardOuter}
                  innerStyle={s.gpCardInner}
                  borderRadius={16}
                >
                  <View style={s.gpTextCol}>
                    <Text style={s.gpDate}>{row.dateDisplay}</Text>
                    <Text style={s.gpVenue}>Practice</Text>
                    <View style={s.gpDistRow}>
                      <Text style={s.gpDist}>{fmtDist(row.distKm)}</Text>
                      <Text style={s.gpDistUnit}>km</Text>
                    </View>
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
                  <View style={s.gpDistRow}>
                    <Text style={s.gpDist}>{fmtDist(row.distKm)}</Text>
                    <Text style={s.gpDistUnit}>km</Text>
                  </View>
                </View>
                <View style={s.gpQualImgWrap}>
                  <Image
                    source={HISTORY_QUAL_IMAGES[row.grade]}
                    style={s.gpQualImg}
                    resizeMode="contain"
                  />
                </View>
              </GradientCardBorder>
            );
          })}
        </View>
      </ScrollView>

      {/* 탭바 위 페이드 */}
      <Svg
        width={windowW}
        height={48}
        style={{ position: 'absolute', bottom: tabH, left: 0 }}
        pointerEvents="none"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Rect
            key={i}
            x={0} y={i * 6}
            width={windowW} height={6}
            fill="#17171C"
            fillOpacity={i / 7}
          />
        ))}
      </Svg>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── 트로피 ──
  trophy: {
    height: 55,
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
    paddingLeft: 10,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    marginTop: 8,
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
    alignItems: 'stretch',
    minHeight: 140,
  },
  gpTextCol: {
    flex: 1,
    paddingLeft: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  gpCircuitWrap: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 24,
    paddingBottom: 24,
    paddingTop: 20,
  },
  gpCircuitSvg: {
    alignSelf: 'flex-end',
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
    marginBottom: 24,
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
  gpQualImgWrap: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 24,
    paddingRight: 28,
  },
  gpQualImg: {
    width: 87,
    height: 87,
  },
});
