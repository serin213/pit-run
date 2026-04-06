/**
 * HomeScreen v4
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { CIRCUITS } from '../config/circuits';
import { useAppStore } from '../store/appStore';
import TireIcon from '../components/TireIcon';
import CircuitMini from '../components/CircuitMini';
import type { HomeScreenProps } from '../navigation/types';

// ─── Assets ──────────────────────────────────────────────────────────────────

const FLAME_ICON = require('../../assets/icons/qualifying-warmup-5ce716.png');

// ─── Tab icon SVG paths ───────────────────────────────────────────────────────

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

// ─── Month navigation arrow paths (세린 연습장 (2)/Vector 1,2.svg) ─────────────

// Vector 2.svg: left arrow ‹  (6×10 viewBox)
const ARROW_LEFT_PATH =
  'M4.58582 9L1.29292 5.70711C0.902397 5.31658 0.902398 4.68342 1.29292 4.29289L4.58582 1';
// Vector 1.svg: right arrow ›  (6×10 viewBox)
const ARROW_RIGHT_PATH =
  'M1 1L4.29289 4.29289C4.68342 4.68342 4.68342 5.31658 4.29289 5.70711L1 9';

// ─── Calendar helpers ────────────────────────────────────────────────────────

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'P', 'Q', 'R'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekDates(ref: Date): Date[] {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    return dd;
  });
}

function calcStreakSet(dates: string[]): Set<string> {
  const set = new Set(dates);
  const result = new Set<string>();
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  while (set.has(toISO(cur))) {
    result.add(toISO(cur));
    cur.setDate(cur.getDate() - 1);
  }
  return result;
}

// colX 동적 계산: M=left 20, R=right 20, 나머지 space-between
function calcColX(cardW: number): number[] {
  // step = (cardW - 2*margin - 7*labelW) / 6 gaps + labelW
  // Simplified: step = (cardW - 64) / 6  (= (R_left - M_left) / 6)
  const step = (cardW - 64) / 6;
  return Array.from({ length: 7 }, (_, i) => Math.round(20 + i * step));
}

// pill 너비: 텍스트박스(24×16) 좌우 4px 여백 → 단일: 32×24, 복수: colX[e]-colX[s]+32
function pillGeometry(colX: number[], startCol: number, endCol: number) {
  return {
    left: colX[startCol] - 4,
    width: colX[endCol] - colX[startCol] + 32,
  };
}

// 연속 달린 날 그룹 찾기
function findRunGroups(
  cells: (number | null)[],
  getISO: (d: number) => string,
  activitySet: Set<string>,
): { start: number; end: number }[] {
  const groups: { start: number; end: number }[] = [];
  let i = 0;
  while (i < cells.length) {
    const d = cells[i];
    if (d && activitySet.has(getISO(d))) {
      let j = i;
      while (j < cells.length && cells[j] && activitySet.has(getISO(cells[j]!))) j++;
      groups.push({ start: i, end: j - 1 });
      i = j;
    } else {
      i++;
    }
  }
  return groups;
}

// ─── GradPill ─────────────────────────────────────────────────────────────────

let _pillId = 0;
function GradPill({ left, top, width, height }: {
  left: number; top: number; width: number; height: number;
}) {
  const id = useMemo(() => `p${_pillId++}`, []);
  return (
    <Svg style={{ position: 'absolute', left, top }} width={width} height={height}>
      <Defs>
        <SvgLG id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#E03A3E" />
          <Stop offset="100%" stopColor="#E03A8A" />
        </SvgLG>
      </Defs>
      <Rect
        x={0.25} y={0.25}
        width={width - 0.5} height={height - 0.5}
        rx={12}
        fill={`url(#${id})`}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.5}
      />
    </Svg>
  );
}

// ─── WeekStrip ────────────────────────────────────────────────────────────────

type WeekStripProps = {
  today: string;
  activitySet: Set<string>;
  colX: number[];
};

function WeekStrip({ today, activitySet, colX }: WeekStripProps) {
  const weekDates = getWeekDates(new Date(today));
  const isoList = weekDates.map(toISO);

  // 달린 날 그룹 (연속 포함)
  const runGroups = findRunGroups(
    weekDates.map((d, i) => i) as number[],
    (i) => isoList[i],
    activitySet,
  );

  const runCols = new Set(runGroups.flatMap((g) =>
    Array.from({ length: g.end - g.start + 1 }, (_, k) => g.start + k),
  ));

  return (
    <View style={s.calCard}>
      {/* 요일 레이블 (top=16) */}
      {WEEK_LABELS.map((label, col) => (
        <Text key={`wl-${col}`} style={[s.calLabel, { left: colX[col] }]}>
          {label}
        </Text>
      ))}

      {/* 달리지 않은 날: 24×24 흰 원형 (opacity 0.1) */}
      {weekDates.map((_, col) => {
        if (runCols.has(col)) return null;
        return <View key={`wc-${col}`} style={[s.dayCircle, { left: colX[col], top: 36 }]} />;
      })}

      {/* 달린 날: gradient pill (연속 그룹별로 하나) */}
      {runGroups.map((g, k) => {
        const { left, width } = pillGeometry(colX, g.start, g.end);
        return <GradPill key={`wp-${k}`} left={left} top={36} width={width} height={24} />;
      })}

      {/* 날짜 숫자 (bold 13px, centered in 24×24) */}
      {weekDates.map((d, col) => {
        const iso = isoList[col];
        const isPast = iso <= today;
        return (
          <Text
            key={`wn-${col}`}
            style={[
              s.calNum,
              { left: colX[col], top: 40 },
              isPast ? s.calNumPast : s.calNumFuture,
            ]}
          >
            {d.getDate()}
          </Text>
        );
      })}
    </View>
  );
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

type MonthGridProps = {
  today: string;
  activitySet: Set<string>;
  colX: number[];
  monthOffset: number;
  onPrev: () => void;
  onNext: () => void;
};

function MonthGrid({ today, activitySet, colX, monthOffset, onPrev, onNext }: MonthGridProps) {
  const base = new Date(today);
  const year = base.getFullYear();
  const month = base.getMonth() + monthOffset;
  const refYear = year + Math.floor(month / 12);
  const refMonth = ((month % 12) + 12) % 12;
  const daysInMonth = new Date(refYear, refMonth + 1, 0).getDate();
  const firstDow = (new Date(refYear, refMonth, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 35) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const ROW_Y = [84, 124, 164, 204, 244];

  function dayISO(d: number) {
    return `${refYear}-${String(refMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return (
    <View style={s.monthCard}>
      {/* 월 이름 */}
      <Text style={s.monthTitle}>{MONTH_NAMES[refMonth]}</Text>

      {/* ‹ 왼쪽 화살표: 박스 좌측에서 24px, April 텍스트 중앙(y=32)과 수직정렬 */}
      <Pressable onPress={onPrev} hitSlop={14} style={{ position: 'absolute', left: 24, top: 27 }}>
        <Svg width={6} height={10} viewBox="0 0 6 10">
          <Path
            d={ARROW_LEFT_PATH}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            opacity={0.5}
          />
        </Svg>
      </Pressable>

      {/* › 오른쪽 화살표: April 텍스트에서 8px 간격 */}
      <Pressable onPress={onNext} hitSlop={14} style={{ position: 'absolute', left: 100, top: 27 }}>
        <Svg width={6} height={10} viewBox="0 0 6 10">
          <Path
            d={ARROW_RIGHT_PATH}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            opacity={0.5}
          />
        </Svg>
      </Pressable>

      {/* 요일 레이블 (top=64) */}
      {WEEK_LABELS.map((label, col) => (
        <Text key={`ml-${col}`} style={[s.calLabel, { left: colX[col], top: 64 }]}>
          {label}
        </Text>
      ))}

      {/* 각 주 행 */}
      {rows.map((row, ri) => {
        if (ri >= ROW_Y.length) return null;
        const ry = ROW_Y[ri];

        // 이 행의 달린 날 그룹
        const runGroups = findRunGroups(
          row,
          (d) => dayISO(d),
          activitySet,
        );
        const runCols = new Set(runGroups.flatMap((g) =>
          Array.from({ length: g.end - g.start + 1 }, (_, k) => g.start + k),
        ));

        return (
          <React.Fragment key={`r-${ri}`}>
            {/* 달리지 않은 날: 원형 */}
            {row.map((d, col) => {
              if (!d || runCols.has(col)) return null;
              return <View key={`mc-${ri}-${col}`} style={[s.dayCircle, { left: colX[col], top: ry }]} />;
            })}

            {/* 달린 날: gradient pill */}
            {runGroups.map((g, si) => {
              const { left, width } = pillGeometry(colX, g.start, g.end);
              return <GradPill key={`mp-${ri}-${si}`} left={left} top={ry} width={width} height={24} />;
            })}

            {/* 날짜 숫자 */}
            {row.map((d, col) => {
              if (!d) return null;
              const iso = dayISO(d);
              const isPast = iso <= today;
              return (
                <Text
                  key={`mn-${ri}-${col}`}
                  style={[
                    s.calNum,
                    { left: colX[col], top: ry + 4 },
                    isPast ? s.calNumPast : s.calNumFuture,
                  ]}
                >
                  {d}
                </Text>
              );
            })}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const FIGMA_STATUS = 59;
const FIGMA_TAB_H = 98;
const FIGMA_SAFE_BOTTOM = 34;

const CAL_H_WEEK = 76;
const CAL_H_MONTH = 292;
const CAL_DELTA = CAL_H_MONTH - CAL_H_WEEK;

// ─── HomeScreen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const py = useCallback(
    (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS),
    [safeTop],
  );

  // 카드·캘린더 너비: 28px 좌우 여백
  const cardW = windowW - 56;
  const cardLeft = 28;

  // 달력 열 위치: M=left 20, R=right 20, 나머지 space-between
  const colX = useMemo(() => calcColX(cardW), [cardW]);

  const selectedCircuitId  = useAppStore((s) => s.selectedCircuitId);
  const selectedTire       = useAppStore((s) => s.selectedTire);
  const paceRecords        = useAppStore((s) => s.paceRecords);
  const activityDates      = useAppStore((s) => s.activityDates);
  const qualifyingResult   = useAppStore((s) => s.qualifyingResult);
  const setQualifyingResult = useAppStore((s) => s.setQualifyingResult);
  const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];

  const todayISO = useMemo(() => toISO(new Date()), []);
  const activitySet = useMemo(() => new Set(activityDates), [activityDates]);
  const streakSet = useMemo(() => calcStreakSet(activityDates), [activityDates]);
  const streakDays = streakSet.size;

  const [calExpanded, setCalExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [devTestActive, setDevTestActive] = useState(false);
  const calHeightAnim = useRef(new Animated.Value(CAL_H_WEEK)).current;
  const cardTransY = useRef(new Animated.Value(0)).current;

  const toggleCal = useCallback(() => {
    const toExpanded = !calExpanded;
    setCalExpanded(toExpanded);
    if (toExpanded) setMonthOffset(0);
    Animated.parallel([
      Animated.timing(calHeightAnim, {
        toValue: toExpanded ? CAL_H_MONTH : CAL_H_WEEK,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(cardTransY, {
        toValue: toExpanded ? CAL_DELTA : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [calExpanded, calHeightAnim, cardTransY]);

  const toggleDevTest = useCallback(() => {
    if (devTestActive) {
      useAppStore.setState({ activityDates: [] });
      setQualifyingResult(null);
      setDevTestActive(false);
    } else {
      const today = new Date();
      const dates: string[] = [];
      [0, 1, 2, 4, 6].forEach((daysAgo) => {
        const d = new Date(today);
        d.setDate(today.getDate() - daysAgo);
        dates.push(d.toISOString().slice(0, 10));
      });
      useAppStore.setState({ activityDates: dates });
      setQualifyingResult({
        warmupMinutes: 5,
        oneKmMs: 300000,
        paceSecPerKm: 300,
        grade: 'A',
        nextIntervalHint: '4:50/km',
      });
      setDevTestActive(true);
    }
  }, [devTestActive, setQualifyingResult]);

  // ── Race time: 퀄리파잉 pace 우선, 없으면 bestEver ────────────────────────
  const paceSec = useMemo(() => {
    if (qualifyingResult) return qualifyingResult.paceSecPerKm;
    if (isFinite(paceRecords.bestEver)) return paceRecords.bestEver;
    return null;
  }, [qualifyingResult, paceRecords.bestEver]);

  const raceTimeStr = useMemo(() => {
    if (!paceSec) return '';
    const totalS = Math.round(paceSec * circuit.distanceKm);
    return `${Math.round(totalS / 60)}min`;
  }, [paceSec, circuit.distanceKm]);

  const showCircuitCard = paceSec !== null;

  // 탭바
  const tabH = FIGMA_TAB_H - FIGMA_SAFE_BOTTOM + safeBottom;
  const tabZoneW = windowW / 4;
  const homeLeft = Math.round(tabZoneW * 0 + (tabZoneW - 32) / 2);
  const playLeft = Math.round(tabZoneW * 1 + (tabZoneW - 32) / 2);
  const taskLeft = Math.round(tabZoneW * 2 + (tabZoneW - 32) / 2);
  const userLeft = Math.round(tabZoneW * 3 + (tabZoneW - 32) / 2);
  const activeBarLeft = homeLeft + 16 - 32;

  // 탭바 홈 구역 그라데이션: 윗변=64px(activeBar 너비와 동일), 아랫변=tabZoneW
  const glowW = Math.round(tabZoneW);
  const glowHalf = Math.max(0, (glowW - 64) / 2);

  // 위→아래 페이드 사다리꼴 슬라이스 (Defs/id 없이 fillOpacity 단계화)
  const glowSlices = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const xl1 = glowHalf * (8 - i) / 8;
    const xr1 = glowW - xl1;
    const xl2 = glowHalf * (7 - i) / 8;
    const xr2 = glowW - xl2;
    const y1 = i * tabH / 8;
    const y2 = (i + 1) * tabH / 8;
    const op = ((7 - i) / 7 * 0.2).toFixed(3);
    return <Path key={i} d={`M${xl1} ${y1}H${xr1}L${xr2} ${y2}H${xl2}Z`} fill={`rgba(224,58,62,${op})`} />;
  }), [glowW, glowHalf, tabH]);

  // 탭바 진입 애니메이션
  // 탭바 바 애니메이션 (글로우는 정적 opacity 0.2 — native animated opacity 제약 회피)
  const barAnim = useRef(new Animated.Value(0)).current;
  const barTranslateX = useMemo(
    () => barAnim.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFocusEffect(
    useCallback(() => {
      barAnim.setValue(0);
      Animated.spring(barAnim,
        { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 },
      ).start();
    }, [barAnim]),
  );


  // 서킷 SVG — 가로 fill, 비율 유지해서 높이 자동 계산
  const circuitSvgLeft = 45; // 카드 내 좌우 45px 마진
  const circuitW = cardW - 90; // fill: cardW - (45 × 2)
  const circuitVB = circuit.viewBox ?? { width: 286, height: 185 };
  const circuitH = Math.round(circuitW * circuitVB.height / circuitVB.width);

  // TireIcon bottom(246+41=287) + 28px gap = 315
  const CIRCUIT_TOP_IN_CARD = 315;
  // 서킷 bottom + 32px gap → START 버튼 top
  const startBtnTopInCard = CIRCUIT_TOP_IN_CARD + circuitH + 32;
  // 카드 전체 높이: START 버튼(44px) + 하단 여백(20px)
  const cardH = startBtnTopInCard + 44 + 20;

  const startBtnW = cardW - 40;

  // 스크롤 콘텐츠 높이: 달력 접힘/펼침 상태에 따라 동적으로 계산, 카드 바깥 하단 여백 42px
  const scrollContentH = py(258) + (calExpanded ? CAL_DELTA : 0) + cardH + 42;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#17171C' }]}>

      {/* ── 스크롤 가능한 메인 콘텐츠 영역 ── */}
      <ScrollView
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: tabH }}
        contentContainerStyle={{ height: scrollContentH }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >

      {/* ── 불꽃 아이콘 ── */}
      <Image
        source={FLAME_ICON}
        style={{ position: 'absolute', left: 32, top: py(108), width: 36, height: 43 }}
        resizeMode="contain"
      />

      {/* ── ON TRACK ── */}
      <Text style={[s.onTrack, { left: 80, top: py(105) }]}>ON TRACK</Text>

      {/* ── "X days": 숫자 Bold + " days" Regular ── */}
      <Text style={[s.streakDaysWrap, { left: 80, top: py(125) }]}>
        <Text style={s.streakNum}>{streakDays}</Text>
        <Text style={s.streakLabel}> days</Text>
      </Text>

      {/* ── 펼치기/접기 화살표 (Vector 1.svg: 16×10, 화면 오른쪽에서 35px) ── */}
      <Pressable
        onPress={toggleCal}
        hitSlop={16}
        style={{ position: 'absolute', right: 35, top: py(134) }}
      >
        <View style={{ transform: [{ rotate: calExpanded ? '180deg' : '0deg' }] }}>
          <Svg width={16} height={10} viewBox="0 0 16 10">
            <Path
              d="M14.5 1.5L8.73279 7.71084C8.33716 8.1369 7.66284 8.1369 7.26721 7.71084L1.5 1.5"
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              opacity={0.5}
            />
          </Svg>
        </View>
      </Pressable>

      {/* ── 캘린더 카드 (y=170) ── */}
      <Animated.View
        style={{
          position: 'absolute',
          left: cardLeft,
          top: py(170),
          width: cardW,
          height: calHeightAnim,
          overflow: 'hidden',
          borderRadius: 12,
        }}
      >
        {calExpanded ? (
          <MonthGrid
            today={todayISO}
            activitySet={activitySet}
            colX={colX}
            monthOffset={monthOffset}
            onPrev={() => setMonthOffset((o) => o - 1)}
            onNext={() => setMonthOffset((o) => o + 1)}
          />
        ) : (
          <WeekStrip today={todayISO} activitySet={activitySet} colX={colX} />
        )}
      </Animated.View>

      {/* ── 서킷 카드 (pace 데이터 있을 때만) ── */}
      {showCircuitCard && (
        <Animated.View
          style={{
            position: 'absolute',
            left: cardLeft,
            top: py(258),
            width: cardW,
            height: cardH,
            backgroundColor: '#202028',
            borderRadius: 12,
            overflow: 'hidden',
            transform: [{ translateY: cardTransY }],
          }}
        >
          <Text style={s.circuitName} numberOfLines={1}>
            {circuit.displayName.toUpperCase()}
          </Text>

          <Text style={[s.statLabel, { left: 28, top: 88 }]}>DISTANCE</Text>
          <Text style={[s.statValue, { left: 28, top: 110 }]}>
            {circuit.distanceKm.toFixed(1)}km
          </Text>

          <Text style={[s.statLabel, { left: 28, top: 154 }]}>RACE TIME</Text>
          <Text style={[s.statValue, { left: 28, top: 176 }]}>{raceTimeStr}</Text>

          <Text style={[s.statLabel, { left: 28, top: 220, fontSize: 15 }]}>TYRE</Text>

          {/* TireIcon 44×41: TYRE 레이블 bottom(236) + gap(10) = top 246 */}
          <View style={{ position: 'absolute', left: 32, top: 246 }}>
            <TireIcon type={selectedTire} />
          </View>

          {/* 서킷 SVG: 좌우 45px 마진, 높이=가로×비율(동적), TireIcon bottom+28 = top 315 */}
          <View style={{ position: 'absolute', left: circuitSvgLeft, top: CIRCUIT_TOP_IN_CARD, width: circuitW, height: circuitH }}>
            <CircuitMini
              trackPath={circuit.trackPath}
              viewBox={circuitVB}
              width={circuitW}
              height={circuitH}
            />
          </View>

          {/* START 버튼: 서킷 bottom + 32px gap */}
          <Pressable
            style={[s.startBtn, { width: startBtnW, top: startBtnTopInCard }]}
            onPress={() => navigation.navigate('Setup')}
          >
            <Text style={s.startBtnTxt}>START</Text>
          </Pressable>
        </Animated.View>
      )}

      </ScrollView>

      {/* ── 그라데이션 페이드 (탭바 위에 고정) ── */}
      <Svg
        width={windowW}
        height={48}
        style={{ position: 'absolute', bottom: tabH, left: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <SvgLG id="gfade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#17171C" stopOpacity="0" />
            <Stop offset="87.5%" stopColor="#17171C" stopOpacity="1" />
          </SvgLG>
        </Defs>
        <Rect x={0} y={0} width={windowW} height={48} fill="url(#gfade)" />
      </Svg>

      {/* ── 데브 버튼 (달린 날 테스트 데이터 토글) ── */}
      {__DEV__ && (
        <Pressable
          onPress={toggleDevTest}
          style={{
            position: 'absolute',
            top: safeTop + 4,
            right: 8,
            backgroundColor: devTestActive ? '#E03A3E' : '#444455',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
            zIndex: 100,
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Formula1-Bold' }}>
            {devTestActive ? 'RESET' : 'DEV'}
          </Text>
        </Pressable>
      )}

      {/* ── 탭바 ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: tabH,
          backgroundColor: '#202028',
        }}
      >
        {/* 홈 구역 사다리꼴 글로우 — 위→아래 그라데이션, Defs/id 미사용 */}
        <Animated.View
          style={{
            position: 'absolute', left: 0, top: 0,
            width: glowW, height: tabH,
            opacity: barAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          }}
          pointerEvents="none"
        >
          <Svg width={glowW} height={tabH} viewBox={`0 0 ${glowW} ${tabH}`}>
            {glowSlices}
          </Svg>
        </Animated.View>

        {/* 활성 인디케이터 바 — 왼쪽에서 오른쪽으로 grow */}
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

        {/* home: 활성 (red) */}
        <View style={{ position: 'absolute', left: homeLeft, top: 20 }}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={HOME_P1} stroke="#E03A3E" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={HOME_P2} stroke="#E03A3E" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>

        {/* play */}
        <Pressable style={{ position: 'absolute', left: playLeft, top: 20 }} onPress={() => navigation.navigate('Race')}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={PLAY_P} stroke="#FFFFFF" strokeWidth={2.25} strokeLinejoin="round" />
          </Svg>
        </Pressable>

        {/* task */}
        <Pressable style={{ position: 'absolute', left: taskLeft, top: 20 }} onPress={() => navigation.navigate('History')}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={TASK_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={TASK_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={TASK_P3} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        {/* user */}
        <Pressable
          style={{ position: 'absolute', left: userLeft, top: 20 }}
          onPress={() => navigation.navigate('Profile')}
        >
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={USER_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={USER_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // 스트릭
  onTrack: {
    position: 'absolute',
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  streakDaysWrap: {
    position: 'absolute',
    lineHeight: 29,
    includeFontPadding: false,
  },
  streakNum: {
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  streakLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 24,
    color: '#FFFFFF',
  },

  // 캘린더 카드
  calCard: {
    flex: 1,
    backgroundColor: '#202028',
    borderRadius: 12,
    overflow: 'hidden',
  },
  monthCard: {
    flex: 1,
    backgroundColor: '#202028',
    borderRadius: 12,
    overflow: 'hidden',
  },
  monthTitle: {
    position: 'absolute',
    left: 36,
    top: 20,
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  calLabel: {
    position: 'absolute',
    top: 16,
    width: 24,
    height: 16,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.3,
    includeFontPadding: false,
  },
  // 모든 날의 24×24 원형 배경 (달린 날은 pill로 대체)
  dayCircle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // 날짜 숫자 (bold 13px, 24×16 텍스트박스, 원형 내 중앙)
  calNum: {
    position: 'absolute',
    width: 24,
    height: 16,
    fontFamily: 'Formula1-Bold',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    textAlign: 'center',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  calNumPast: {
    opacity: 1,
  },
  calNumFuture: {
    opacity: 0.3,
  },

  // 서킷 카드
  circuitName: {
    position: 'absolute',
    left: 28,
    top: 28,
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  statLabel: {
    position: 'absolute',
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  statValue: {
    position: 'absolute',
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  startBtn: {
    position: 'absolute',
    left: 20,
    height: 44,
    backgroundColor: '#E03A3E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnTxt: {
    fontFamily: 'Formula1-Bold',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.17,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
