/**
 * HistoryScreen — 세 번째 탭 (clipboard): 퀄리파잉 히스토리 그래프 + 그랑프리 히스토리
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CIRCUITS } from '../config/circuits';
import { fmtDist, fmtPace } from '../utils/format';
import type { HistoryScreenProps } from '../navigation/types';

// ─── Tab icon paths (공유) ───────────────────────────────────────────────────

const HOME_P1 =
  'M4 15.9877V19.335C4 23.7347 4 25.9346 5.36683 27.3015C6.73367 28.6683 8.93356 28.6683 13.3333 28.6683H18.6667C23.0664 28.6683 25.2663 28.6683 26.6332 27.3015C28 25.9346 28 23.7347 28 19.335V15.9877C28 13.7461 28 12.6253 27.5255 11.655C27.0509 10.6848 26.1662 9.99667 24.3968 8.62043L21.7301 6.54636C18.9775 4.40543 17.6012 3.33496 16 3.33496C14.3988 3.33496 13.0225 4.40543 10.2699 6.54636L7.60322 8.62044C5.83378 9.99667 4.94906 10.6848 4.47453 11.655C4 12.6253 4 13.7461 4 15.9877Z';
const HOME_P2 =
  'M20 28.6676V22.001C20 20.1154 20 19.1725 19.4142 18.5868C18.8284 18.001 17.8856 18.001 16 18.001C14.1144 18.001 13.1716 18.001 12.5858 18.5868C12 19.1725 12 20.1154 12 22.001V28.6676';
const PLAY_P =
  'M28.489 17.3536C27.9168 19.5024 25.2122 21.0208 19.8031 24.0577C14.5741 26.9935 11.9596 28.4614 9.85259 27.8713C8.98149 27.6274 8.18782 27.1641 7.54773 26.5259C5.99953 24.9822 5.99953 21.9882 5.99953 16C5.99953 10.0118 5.99953 7.01776 7.54773 5.47411C8.18782 4.83591 8.98149 4.37262 9.85259 4.12867C11.9596 3.53864 14.5741 5.00652 19.8031 7.94228C25.2122 10.9792 27.9168 12.4976 28.489 14.6464C28.7252 15.5334 28.7252 16.4666 28.489 17.3536Z';
const TASK_P1 =
  'M19.3333 2.66504H12.6667C11.5621 2.66504 10.6667 3.56047 10.6667 4.66504C10.6667 5.76961 11.5621 6.66504 12.6667 6.66504H19.3333C20.4379 6.66504 21.3333 5.76961 21.3333 4.66504C21.3333 3.56047 20.4379 2.66504 19.3333 2.66504Z';
const TASK_P2 = 'M10.6667 19.9984H15.2381M10.6667 14.665H21.3333';
const TASK_P3 =
  'M21.3329 4.66504C23.4041 4.72745 24.6396 4.95847 25.4947 5.81353C26.6662 6.98509 26.6662 8.87069 26.6662 12.6419L26.6662 21.331C26.6662 25.1022 26.6662 26.9878 25.4946 28.1594C24.3231 29.331 22.4374 29.331 18.6662 29.331L13.3329 29.331C9.56164 29.331 7.67603 29.331 6.50446 28.1594C5.33288 26.9879 5.33288 25.1023 5.33287 21.331L5.33289 12.642C5.33288 8.87071 5.33288 6.98509 6.50445 5.81351C7.3595 4.95846 8.59489 4.72745 10.6661 4.66504';
const USER_P1 =
  'M22.1942 9.96707C22.1942 6.67478 19.5253 4.00586 16.233 4.00586C12.9407 4.00586 10.2718 6.67478 10.2718 9.96707C10.2718 13.2594 12.9407 15.9283 16.233 15.9283C19.5253 15.9283 22.1942 13.2594 22.1942 9.96707Z';
const USER_P2 =
  'M16.2337 15.9277C20.8402 15.9277 24.7494 19.0025 26.1316 23.2679C26.7914 25.3041 25.5482 27.4024 23.5367 28.1342C18.0726 30.122 12.643 29.33 8.95714 28.0687C6.93196 27.3756 5.67601 25.3041 6.33586 23.2679C7.71806 19.0025 11.6272 15.9277 16.2337 15.9277Z';

/** 툴팁 우측 셰브론 — SVG, #FFFFFF 50% (PNG보다 정확한 알파) */
const TOOLTIP_CHEVRON_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

/** 레이서 카드(프로필)와 동일 F2 등급 배지 */
const GRADE_F2_BADGE = require('../../assets/grade-f2.png') as ReturnType<typeof require>;

// ─── Constants ───────────────────────────────────────────────────────────────

const FIGMA_STATUS = 59;
const FIGMA_TAB_H = 98;
const FIGMA_SAFE_BOTTOM = 34;

const SIDE_PAD = 28;
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

/** 데모 데이터 — 서버 연동 시 스토어/API로 교체 */
const MOCK_QUALIFYING: QHistRow[] = [
  { iso: '2024-03-25', label: '03.25', paceSec: 318 },
  { iso: '2024-05-26', label: '05.26', paceSec: 312 },
  { iso: '2024-06-30', label: '06.31', paceSec: 329, promotedGrade: 'F2' },
  { iso: '2025-01-01', label: '01.01', paceSec: 315 },
  { iso: '2025-02-02', label: '02.02', paceSec: 308 },
];

const MOCK_GP: GpRow[] = [
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

  const py = (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS);

  const contentW = windowW - SIDE_PAD * 2;

  const tabH = FIGMA_TAB_H - FIGMA_SAFE_BOTTOM + safeBottom;
  const tabZoneW = windowW / 4;
  const homeLeft = Math.round(tabZoneW * 0 + (tabZoneW - 32) / 2);
  const playLeft = Math.round(tabZoneW * 1 + (tabZoneW - 32) / 2);
  const taskLeft = Math.round(tabZoneW * 2 + (tabZoneW - 32) / 2);
  const userLeft = Math.round(tabZoneW * 3 + (tabZoneW - 32) / 2);

  const activeBarLeft = taskLeft + 16 - 32;
  const glowW = Math.round(tabZoneW);
  const glowHalf = Math.max(0, (glowW - 64) / 2);
  const glowLeft = Math.round(tabZoneW * 2);

  const glowSlices = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const xl1 = (glowHalf * (8 - i)) / 8;
        const xr1 = glowW - xl1;
        const xl2 = (glowHalf * (7 - i)) / 8;
        const xr2 = glowW - xl2;
        const y1 = (i * tabH) / 8;
        const y2 = ((i + 1) * tabH) / 8;
        const op = (((7 - i) / 7) * 0.2).toFixed(3);
        return <Path key={i} d={`M${xl1} ${y1}H${xr1}L${xr2} ${y2}H${xl2}Z`} fill={`rgba(224,58,62,${op})`} />;
      }),
    [glowW, glowHalf, tabH],
  );

  const barAnim = useRef(new Animated.Value(0)).current;
  const barTranslateX = useMemo(
    () => barAnim.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFocusEffect(
    useCallback(() => {
      barAnim.setValue(0);
      Animated.spring(barAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }).start();
    }, [barAnim]),
  );

  const sortedQ = useMemo(() => [...MOCK_QUALIFYING].sort((a, b) => a.iso.localeCompare(b.iso)), []);
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
    () => [...MOCK_GP].sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
    [],
  );

  const monaco = CIRCUITS.find((c) => c.id === 'monaco') ?? CIRCUITS[0];
  const circuitVB = monaco.viewBox ?? { width: 337, height: 139 };
  const circuitTargetH = 65;
  const circuitScale = circuitTargetH / circuitVB.height;
  const circuitDrawW = circuitVB.width * circuitScale;

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
          {gpSorted.map((gp) => (
            <View key={gp.sortKey} style={s.gpCard}>
              <View style={s.gpTextCol}>
                <Text style={s.gpDate}>{gp.dateDisplay}</Text>
                <Text style={s.gpVenue}>{gp.venue}</Text>
                <Text style={s.gpTime}>{gp.timeStr}</Text>
              </View>
              <View style={[s.gpCircuitWrap, { minWidth: circuitDrawW }]}>
                <Svg
                  width={circuitDrawW}
                  height={circuitTargetH}
                  viewBox={`0 0 ${circuitVB.width} ${circuitVB.height}`}
                  style={s.gpCircuitSvg}
                >
                  <Path d={monaco.trackPath} stroke="#FFFFFF" strokeWidth={4} fill="none" />
                </Svg>
              </View>
            </View>
          ))}
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

      {/* Tab bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: tabH,
          backgroundColor: '#202028',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: glowLeft,
            top: 0,
            width: glowW,
            height: tabH,
            opacity: barAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          }}
          pointerEvents="none"
        >
          <Svg width={glowW} height={tabH} viewBox={`0 0 ${glowW} ${tabH}`}>
            {glowSlices}
          </Svg>
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            left: activeBarLeft,
            top: 0,
            width: 64,
            height: 2,
            backgroundColor: '#E03A3E',
            transform: [{ translateX: barTranslateX }, { scaleX: barAnim }],
          }}
        />

        <Pressable style={{ position: 'absolute', left: homeLeft, top: 20 }} onPress={() => navigation.navigate('Home')}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={HOME_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={HOME_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <Pressable style={{ position: 'absolute', left: playLeft, top: 20 }} onPress={() => navigation.navigate('Race')}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={PLAY_P} stroke="#FFFFFF" strokeWidth={2.25} strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <View style={{ position: 'absolute', left: taskLeft, top: 20 }}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={TASK_P1} stroke="#E03A3E" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={TASK_P2} stroke="#E03A3E" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={TASK_P3} stroke="#E03A3E" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>

        <Pressable style={{ position: 'absolute', left: userLeft, top: 20 }} onPress={() => navigation.navigate('Profile')}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={USER_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={USER_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>
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
  gpCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 140,
    backgroundColor: '#202028',
    borderRadius: 12,
    overflow: 'hidden',
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
