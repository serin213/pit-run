/**
 * HistoryScreen — 세 번째 탭 (clipboard): 퀄리파잉 히스토리 그래프 + 그랑프리 히스토리
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
import { fmtDist, fmtPace, fmtTime } from '../utils/format';
import { fetchQualifyingHistory } from '../api/qualifying';
import { fetchSessions } from '../api/sessions';
import { GRADE_DISPLAY_NAME } from '../constants/grade';
import type { HistoryScreenProps } from '../navigation/types';
import GradientCardBorder from '../components/GradientCardBorder';
import { useTabBarTotalHeight } from '../components/TabBar';


/** 툴팁 우측 셰브론 — SVG, #FFFFFF 50% (PNG보다 정확한 알파) */
const TOOLTIP_CHEVRON_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

/** 레이서 카드(프로필)와 동일 F2 등급 배지 */
const GRADE_F2_BADGE = require('../../assets/grade-f2.png') as ReturnType<typeof require>;

// ─── Constants ───────────────────────────────────────────────────────────────

const FIGMA_STATUS = 59;

const SIDE_PAD = 20;
const GP_TITLE_PAD_L = 32;
const COL_MIN_W = 65;
/** 퀄리파잉 그래프 세로 막대 사이 간격 */
const COL_GAP = 5;
/** 페이스 줄(lineHeight 24)·셰브론(13)과 맞춰 승급 툴팁 세로가 동일하도록 */
const GRADE_BADGE_H = 24;
const GRADE_BADGE_W = Math.round((58 / 29) * GRADE_BADGE_H);
/** 다음 등급(F2) 기준 1km 페이스(초) — 점선 라벨 "F2 5'00"" */
const THRESHOLD_SEC = 5 * 60;
/** 세로축: 데이터·F2 포함 후 최소 여백(초) */
const PACE_AXIS_PAD_MIN_SEC = 2;
/** 세로축: 데이터+기준 구간(span) 대비 비례 여백 */
const PACE_AXIS_PAD_RATIO = 0.1;
/** 페이스 편차가 매우 작을 때도 곡선이 보이도록 하는 최소 세로축 길이(초) */
const PACE_AXIS_MIN_SPAN_SEC = 22;

type QHistRow = {
  iso: string;
  label: string;
  paceSec: number;
  /** 승급 달성 시 표시할 등급 라벨 (예: F2) */
  promotedGrade?: string;
};

type GpRow = {
  sortKey: string;
  dateDisplay: string;
  venue: string;
  timeStr: string;
  circuitId: string;
};

/** 데모 데이터 — 비로그인 시 또는 데이터 없을 때 폴백 */
const FALLBACK_QUALIFYING: QHistRow[] = [
  { iso: '2024-03-25', label: '03.25', paceSec: 318 },
  { iso: '2024-05-26', label: '05.26', paceSec: 312 },
  { iso: '2024-06-30', label: '06.31', paceSec: 329, promotedGrade: 'F2' },
  { iso: '2025-01-01', label: '01.01', paceSec: 315 },
  { iso: '2025-02-02', label: '02.02', paceSec: 308 },
];

const FALLBACK_GP: GpRow[] = [
  { sortKey: '2023-01-26', dateDisplay: '26.01.23', venue: 'MONACO', timeStr: "5'21\"", circuitId: 'monaco' },
];

let _histGradSeq = 0;

function maxFitColumns(contentW: number, gap: number): number {
  let k = 0;
  while (k * COL_MIN_W + Math.max(0, k - 1) * gap <= contentW) k++;
  return Math.max(1, k - 1);
}

/** 빠른 페이스(작은 초) → 아래, 느린 페이스 → 위 */
function paceToY(paceSec: number, minP: number, maxP: number, plotTop: number, plotH: number): number {
  if (maxP <= minP) return plotTop + plotH / 2;
  const t = (paceSec - minP) / (maxP - minP);
  return plotTop + (1 - t) * plotH;
}

/** 보이는 페이스 + 다음 등급 기준선(F2)을 항상 포함하고, 작은 차이도 세로로 잘 보이게 축 범위를 잡는다. */
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

function smoothLinePath(
  xs: number[],
  ys: number[],
): string {
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
  const safeBottom = useSafeBottom();
  const totalDistanceKm = useAppStore((s) => s.totalDistanceKm);
  const { isAuthenticated } = useAuthStore();

  const py = (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS);

  const contentW = windowW - SIDE_PAD * 2;

  const tabH = useTabBarTotalHeight();

  // ─── Supabase 데이터 fetch ────────────────────────────────────────────────
  const [qualifyingData, setQualifyingData] = useState<QHistRow[]>(FALLBACK_QUALIFYING);
  const [gpData, setGpData] = useState<GpRow[]>(FALLBACK_GP);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;

      (async () => {
        try {
          const rows = await fetchQualifyingHistory();
          if (rows.length > 0) {
            // 이전 등급과 비교하여 승급 여부 판단
            const sorted = [...rows].sort(
              (a, b) => a.recorded_at.localeCompare(b.recorded_at),
            );
            let prevGrade: string | null = null;
            const mapped: QHistRow[] = sorted.map((r) => {
              const d = new Date(r.recorded_at);
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const promoted =
                prevGrade && r.grade !== prevGrade
                  ? GRADE_DISPLAY_NAME[r.grade]
                  : undefined;
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
          const sessions = await fetchSessions(50);
          const gpSessions = sessions.filter(
            (s) => s.type === 'grand_prix' && s.status === 'completed',
          );
          if (gpSessions.length > 0) {
            const mapped: GpRow[] = gpSessions.map((s) => {
              const d = new Date(s.started_at);
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yy = String(d.getFullYear()).slice(2);
              const circuit = CIRCUITS.find((c) => c.id === s.circuit_id);
              return {
                sortKey: s.started_at.slice(0, 10),
                dateDisplay: `${dd}.${mm}.${yy}`,
                venue: circuit?.displayName?.toUpperCase() ?? s.circuit_id?.toUpperCase() ?? 'UNKNOWN',
                timeStr: fmtTime(s.total_time_ms),
                circuitId: s.circuit_id ?? 'monaco',
              };
            });
            setGpData(mapped);
          }
        } catch (e) {
          console.warn('[HistoryScreen] sessions fetch error:', e);
        }
      })();
    }, [isAuthenticated]),
  );

  const sortedQ = useMemo(() => [...qualifyingData].sort((a, b) => a.iso.localeCompare(b.iso)), [qualifyingData]);
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

  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  const colAreaH = 166;
  const barH = colAreaH - 28;
  const plotH = 78;
  const plotTopInBlock = 28;

  const { linePath, areaPath, thresholdY } = useMemo(() => {
    if (visible.length === 0) {
      return {
        minP: THRESHOLD_SEC - 30,
        maxP: THRESHOLD_SEC + 30,
        linePath: '',
        areaPath: '',
        thresholdY: plotTopInBlock + plotH / 2,
      };
    }
    const paces = visible.map((v) => v.paceSec);
    const { minP, maxP } = computePaceAxisMinMax(paces, THRESHOLD_SEC);
    const n = visible.length;
    const xs =
      n <= 1
        ? [contentW / 2]
        : visible.map((_, i) => (i / (n - 1)) * contentW);
    const ys = visible.map((v) => paceToY(v.paceSec, minP, maxP, plotTopInBlock, plotH));
    const linePath = smoothLinePath(xs, ys);
    const lastX = xs[xs.length - 1];
    const firstX = xs[0];
    const baseY = barH - 2;
    const areaPath =
      visible.length > 0
        ? `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`
        : '';
    const thresholdY = paceToY(THRESHOLD_SEC, minP, maxP, plotTopInBlock, plotH);
    return { linePath, areaPath, thresholdY };
  }, [visible, contentW, plotH, plotTopInBlock, barH]);

  const gradPrefix = useRef(`qhG_${++_histGradSeq}`).current;

  const gpSorted = useMemo(
    () => [...gpData].sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
    [gpData],
  );

  const circuitTargetH = 65;

  /** GP 카드에 표시할 서킷 정보 lookup */
  const getCircuitInfo = useCallback((circuitId: string) => {
    const circuit = CIRCUITS.find((c) => c.id === circuitId) ?? CIRCUITS[0];
    const vb = circuit.viewBox ?? { width: 337, height: 139 };
    const scale = circuitTargetH / vb.height;
    return { circuit, vb, drawW: vb.width * scale };
  }, []);

  const selected = visible[selectedIdx];
  const bubbleCenterX = SIDE_PAD + selectedIdx * (colW + COL_GAP) + colW / 2;

  const [tooltipWrapW, setTooltipWrapW] = useState(0);
  const tooltipWrapClamped = tooltipWrapW > 0 ? tooltipWrapW : 160;
  const tooltipWrapHalf = tooltipWrapClamped / 2;
  /** 꼬리 끝이 선택 컬럼 중앙에 오도록 툴팁 전체 래퍼 정렬 */
  const tooltipWrapLeft = Math.max(
    SIDE_PAD,
    Math.min(windowW - SIDE_PAD - tooltipWrapClamped, bubbleCenterX - tooltipWrapHalf),
  );

  /** PNG·피그마와 동일하게 보이도록 스토어 0일 때만 데모 값(스토어에 값 있으면 실제 사용) */
  const distKmDisplay = totalDistanceKm > 0 ? totalDistanceKm : 23.14;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#17171C' }]}>
      <BlurView intensity={60} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop, zIndex: 1000 }} pointerEvents="none" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: tabH + 24,
          paddingTop: 0,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Total distance — 아랫선(baseline) 정렬, 숫자–km total 간격 8 */}
        <View style={[s.distRow, { marginHorizontal: SIDE_PAD, marginTop: py(86) }]}>
          <Text style={s.bigNum}>{fmtDist(distKmDisplay)}</Text>
          <Text style={s.kmTotal}>km total</Text>
        </View>

        <Text style={[s.sectionTitle, { marginLeft: SIDE_PAD, marginTop: 52 }]}>Qualifying History</Text>

        {/* 그래프: 좌우 28 inset, 막대 간격 5 */}
        <View style={{ width: windowW, marginTop: 24, minHeight: colAreaH + 44 }}>
          {selected && (
            <View style={[s.tooltipWrap, { left: tooltipWrapLeft, top: 0 }]} onLayout={(e) => setTooltipWrapW(e.nativeEvent.layout.width)}>
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

          <View style={{ marginLeft: SIDE_PAD, width: contentW, marginTop: 56, height: colAreaH, position: 'relative' }}>
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
                        x="0"
                        y="0"
                        width={colW}
                        height={barH}
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

            <View style={{ position: 'absolute', left: 0, top: 0, width: contentW, height: barH }} pointerEvents="none">
              <Svg width={contentW} height={barH} viewBox={`0 0 ${contentW} ${barH}`}>
                <Defs>
                  <SvgLG id={`${gradPrefix}_area`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#E03A3E" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0" />
                  </SvgLG>
                  <SvgLG
                    id={`${gradPrefix}_line`}
                    x1="0"
                    y1="0"
                    x2={contentW}
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0%" stopColor="#E03A3E" stopOpacity="0" />
                    <Stop offset="10%" stopColor="#E03A3E" stopOpacity="1" />
                    <Stop offset="90%" stopColor="#E03A3E" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#E03A3E" stopOpacity="0" />
                  </SvgLG>
                </Defs>
                {areaPath ? <Path d={areaPath} fill={`url(#${gradPrefix}_area)`} opacity={0.2} /> : null}
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
              <Text style={[s.thresholdLabel, { top: Math.max(0, thresholdY - 20) }]}>{`F2 ${fmtPace(THRESHOLD_SEC)}`}</Text>
            </View>
          </View>
        </View>

        <Text style={[s.sectionTitle, { marginLeft: GP_TITLE_PAD_L, marginTop: 64 }]}>Grand Prix History</Text>

        <View style={{ marginHorizontal: SIDE_PAD, marginTop: 16, gap: 12 }}>
          {gpSorted.map((gp) => {
            const { circuit, vb, drawW } = getCircuitInfo(gp.circuitId);
            return (
              <GradientCardBorder key={gp.sortKey} style={s.gpCardOuter} innerStyle={s.gpCardInner}>
                <View style={s.gpTextCol}>
                  <Text style={s.gpDate}>{gp.dateDisplay}</Text>
                  <Text style={s.gpVenue}>{gp.venue}</Text>
                  <Text style={s.gpTime}>{gp.timeStr}</Text>
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
          })}
        </View>
      </ScrollView>

      {/* Fade above tab bar */}
      <Svg
        width={windowW}
        height={48}
        style={{ position: 'absolute', bottom: tabH, left: 0 }}
        pointerEvents="none"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Rect
            key={i}
            x={0}
            y={i * 6}
            width={windowW}
            height={6}
            fill="#17171C"
            fillOpacity={i / 7}
          />
        ))}
      </Svg>


    </View>
  );
}

const s = StyleSheet.create({
  distRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bigNum: {
    fontFamily: 'Formula1-Black',
    fontSize: 72,
    lineHeight: 86,
    letterSpacing: 0.05 * 72,
    color: '#FFFFFF',
  },
  kmTotal: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.02 * 17,
    color: '#FFFFFF',
    opacity: 0.5,
  },
  sectionTitle: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.02 * 17,
    color: '#FFFFFF',
    opacity: 0.5,
  },
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
  gpCardOuter: {
    borderRadius: 12,
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
  gpTime: {
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.02 * 30,
    color: '#FFFFFF',
  },
});
