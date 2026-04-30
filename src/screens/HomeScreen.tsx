/**
 * HomeScreen v4
 */

import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Defs,
  LinearGradient as SvgLG,
  Line as SvgLine,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import { CIRCUITS } from '../config/circuits';
import { useAppStore } from '../store/appStore';
import { useRunStore } from '../store/runStore';
import TireIcon from '../components/TireIcon';
import CircuitMini from '../components/CircuitMini';
import GradientCardBorder, { CARD_FILL } from '../components/GradientCardBorder';
import { useTabBarTotalHeight } from '../components/TabBar';
import type { HomeScreenProps } from '../navigation/types';
import { radius } from '../constants/radius';
import {
  MonthGrid,
  WeekStrip,
  calcColX,
  toISO,
} from '../components/MonthCalendar';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useAuthStore } from '../store/authStore';
import { logSessionStarted } from '../lib/analytics/raceEvents';
import { GRADE_TIERS } from '../lib/grading/calcGrade';
import { GRADE_ORDER } from '../constants/grade';
import type { QualifyingGrade } from '../types';
import { fetchSessions } from '../api/sessions';
import { fmtDist } from '../utils/format';
import { getWeekDates } from '../components/MonthCalendar';

// ─── Assets ──────────────────────────────────────────────────────────────────

const FLAME_ICON = require('../../assets/icons/qualifying-warmup-5ce716.png');
const QUALIFYING_TROPHY = require('../../assets/qualifying-card-trophy.png');

const TROPHY_IMAGES: Record<QualifyingGrade, ReturnType<typeof require>> = {
  f1_champion: require('../../assets/f1-champion.png'),
  f1: require('../../assets/f1.png'),
  f1_rookie: require('../../assets/f1-rookie.png'),
  f2: require('../../assets/f2.png'),
  f3: require('../../assets/f3.png'),
};

const RENEWAL_TROPHY_IMAGES: Record<QualifyingGrade, ReturnType<typeof require>> = {
  f1_champion: require('../../assets/qualifying/trophy/f1-champion.png'),
  f1: require('../../assets/qualifying/trophy/f1.png'),
  f1_rookie: require('../../assets/qualifying/trophy/f1-rookie.png'),
  f2: require('../../assets/qualifying/trophy/f2.png'),
  f3: require('../../assets/qualifying/trophy/f3.png'),
};

// ─── Grade renewal helpers ────────────────────────────────────────────────────

const GRADE_COLORS: Record<QualifyingGrade, string> = {
  f3: '#FFFFFF',
  f2: '#FCB827',
  f1_rookie: '#59B345',
  f1: '#8528C5',
  f1_champion: '#E03A3E',
};

const GRADE_LABELS: Record<QualifyingGrade, string> = {
  f3: 'F3',
  f2: 'F2',
  f1_rookie: 'F1 ROOKIE',
  f1: 'F1',
  f1_champion: 'F1 CHAMPION',
};

const RENEWAL_SUGGEST_DAYS = 30;

function getNextGrade(grade: QualifyingGrade): QualifyingGrade | null {
  const idx = GRADE_ORDER.indexOf(grade);
  if (idx <= 0) return null; // f1_champion (idx=0) has no next
  return GRADE_ORDER[idx - 1];
}

/** 현재 등급 범위 내에서 다음 등급까지 얼마나 왔는지 (0~1) */
function getFilledRatio(grade: QualifyingGrade, paceSecPerKm: number): number {
  const tier = GRADE_TIERS.find((t) => t.grade === grade);
  if (!tier) return 0.5;
  const upper = tier.maxPaceSec ?? 600; // f3는 상한 없음 → 600으로 근사
  const lower = tier.minPaceSec;
  const ratio = (upper - paceSecPerKm) / (upper - lower);
  return Math.max(0.05, Math.min(0.95, ratio));
}

/** 페이스 차이를 M'SS" 형식으로 변환 */
function formatGapSec(gapSec: number): string {
  const s = Math.max(0, Math.round(gapSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}'${String(sec).padStart(2, '0')}"`;
}


// ─── GapRow (퀄리파잉 갱신 카드 프로그레스 섹션) ──────────────────────────────────

type GapRowProps = {
  barWidth: number;
  filledWidth: number;
  nextGrade: QualifyingGrade;
  gapSec: number;
  gapRowId: string;
};

function GapRow({ barWidth, filledWidth, nextGrade, gapSec, gapRowId }: GapRowProps) {
  const [leftDashW, setLeftDashW] = useState(0);
  const [rightDashW, setRightDashW] = useState(0);
  const nextColor = GRADE_COLORS[nextGrade];
  const gapStr = formatGapSec(gapSec);

  const ROW_H = 16;
  const LINE_H = 10;

  return (
    <View style={{ width: barWidth, height: ROW_H, flexDirection: 'row', alignItems: 'center' }}>
      {/* 채워진 영역 여백 */}
      <View style={{ width: filledWidth }} />

      {/* 왼쪽 세로선 */}
      <View style={{ width: 1, height: LINE_H, backgroundColor: nextColor }} />

      {/* 왼쪽 점선 영역 */}
      <View
        style={{ flex: 1, height: ROW_H, justifyContent: 'center' }}
        onLayout={(e) => setLeftDashW(Math.floor(e.nativeEvent.layout.width))}
      >
        {leftDashW > 0 && (
          <Svg width={leftDashW} height={2}>
            <SvgLine x1={0} y1={1} x2={leftDashW} y2={1}
              stroke={nextColor} strokeWidth={1} strokeDasharray="3,3" />
          </Svg>
        )}
      </View>

      {/* gap 텍스트 */}
      <Text
        key={`gap-${gapRowId}`}
        style={{
          marginHorizontal: 4,
          color: nextColor,
          fontFamily: 'Formula1-Regular',
          fontSize: 13,
          lineHeight: ROW_H,
          letterSpacing: -0.26,
          includeFontPadding: false,
        }}
      >
        {gapStr}
      </Text>

      {/* 오른쪽 점선 영역 */}
      <View
        style={{ flex: 1, height: ROW_H, justifyContent: 'center' }}
        onLayout={(e) => setRightDashW(Math.floor(e.nativeEvent.layout.width))}
      >
        {rightDashW > 0 && (
          <Svg width={rightDashW} height={2}>
            <SvgLine x1={0} y1={1} x2={rightDashW} y2={1}
              stroke={nextColor} strokeWidth={1} strokeDasharray="3,3" />
          </Svg>
        )}
      </View>

      {/* 오른쪽 세로선 */}
      <View style={{ width: 1, height: LINE_H, backgroundColor: nextColor }} />
    </View>
  );
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const FIGMA_STATUS = 44;
const FIGMA_TAB_H = 98;
const FIGMA_SAFE_BOTTOM = 34;

const CAL_H_WEEK = 80;
const CAL_H_MONTH = 292;
const CAL_DELTA = CAL_H_MONTH - CAL_H_WEEK;

// ─── HomeScreen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  // 홈 최초 진입 시 위치 권한 요청
  useLocationPermission({ requestOnMount: true });

  const { user } = useAuthStore();

  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      slideAnim.setValue(24);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, [slideAnim, fadeAnim]),
  );

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        logSessionStarted({ userId: user.id }).catch(() => {});
      }
    }, [user?.id]),
  );

  const py = useCallback(
    (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS),
    [safeTop],
  );

  // 카드·캘린더 너비: 28px 좌우 여백
  const cardW = windowW - 40;
  const cardLeft = 20;

  // 달력 열 위치: M=left 20, R=right 20, 나머지 space-between
  const colX = useMemo(() => calcColX(cardW), [cardW]);

  const selectedCircuitId  = useAppStore((s) => s.selectedCircuitId);
  const selectedTire       = useAppStore((s) => s.selectedTire);
  const paceRecords        = useAppStore((s) => s.paceRecords);
  const activityDates      = useAppStore((s) => s.activityDates);
  const qualifyingDates    = useAppStore((s) => s.qualifyingDates);
  const qualifyingResult   = useAppStore((s) => s.qualifyingResult);
  const setQualifyingResult = useAppStore((s) => s.setQualifyingResult);
  const circuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];

  const todayISO = useMemo(() => toISO(new Date()), []);
  const activitySet = useMemo(() => new Set(activityDates), [activityDates]);
  const qualifyingSet = useMemo(() => new Set(qualifyingDates), [qualifyingDates]);

  const [weekDistKm, setWeekDistKm] = useState(0);
  const [monthDistKm, setMonthDistKm] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      (async () => {
        try {
          const sessions = await fetchSessions(100);
          const completed = sessions.filter((s) => s.status === 'completed');

          const now = new Date();
          const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const weekDates = getWeekDates(now);
          const weekStart = toISO(weekDates[0]);
          const weekEnd = toISO(weekDates[6]);

          const wDist = completed
            .filter((s) => {
              const d = s.started_at.slice(0, 10);
              return d >= weekStart && d <= weekEnd;
            })
            .reduce((sum, s) => sum + (s.total_dist_km ?? 0), 0);

          const mDist = completed
            .filter((s) => s.started_at.slice(0, 7) === thisMonth)
            .reduce((sum, s) => sum + (s.total_dist_km ?? 0), 0);

          setWeekDistKm(wDist);
          setMonthDistKm(mDist);
        } catch (e) {
          console.warn('[HomeScreen] sessions fetch error:', e);
        }
      })();
    }, [user?.id]),
  );

  // 인스턴스 고유 ID (여러 HomeScreen 인스턴스의 gradient ID 충돌 방지)
  const rawId = useId();
  const idBase = rawId.replace(/[^a-zA-Z0-9]/g, '_');

  const [calExpanded, setCalExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [devTestActive, setDevTestActive] = useState(false);
  const [svgKey, setSvgKey] = useState(0);
  const calHeightAnim = useRef(new Animated.Value(CAL_H_WEEK)).current;
  const cardTransY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

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
        grade: 'f2',
        nextIntervalHint: '4:50/km',
        qualifiedAt: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31일 전 → 갱신 카드 표시
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

  // 퀄리파잉 갱신 제안 카드 조건
  const renewalNextGrade = qualifyingResult ? getNextGrade(qualifyingResult.grade) : null;
  const showRenewalCard = useMemo(() => {
    if (!qualifyingResult || !renewalNextGrade) return false;
    if (!qualifyingResult.qualifiedAt) return false;
    const daysSince = (Date.now() - qualifyingResult.qualifiedAt) / (24 * 60 * 60 * 1000);
    return daysSince >= RENEWAL_SUGGEST_DAYS;
  }, [qualifyingResult, renewalNextGrade]);

  const showCircuitCard = !!qualifyingResult && !showRenewalCard;
  const showQualifyingCard = !qualifyingResult;

  // 퀄리파잉 제안 카드 레이아웃 (값 고정)
  // top:24 + Qualifying(36) + gap16 + subtitle(26*2=52) + gap40 + image(171) + gap32 + CTA(44) + bottom20
  const qSubtitleTop = 24 + 36 + 16;          // 76
  const qSubtitleH = Math.round(20 * 1.3) * 2; // 52 (line-height 130%, 2 lines)
  const qImageTop = qSubtitleTop + qSubtitleH + 40; // 168
  const qImageW = 200;
  const qImageH = 171;
  const qCtaTop = qImageTop + qImageH + 32;   // 371
  const qCardH = qCtaTop + 44 + 20;           // 435

  // 퀄리파잉 갱신 카드 레이아웃
  const rqBarWidth = cardW - 48;              // 양옆 24
  const rqTrophyTop = qSubtitleTop + qSubtitleH + 50; // 178
  const rqBarTop = rqTrophyTop + 52 + 16;    // 246
  const rqTextTop = rqBarTop + 12 + 8;       // 266
  const rqStartTop = rqTextTop + 16 + 28;    // 310
  const renewalCardH = rqStartTop + 44 + 20;  // 374

  const tabH = useTabBarTotalHeight();

  useFocusEffect(
    useCallback(() => {
      setSvgKey(k => k + 1);
    }, []),
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
  const activeCardH = showCircuitCard ? cardH : showRenewalCard ? renewalCardH : qCardH;
  const scrollContentH = py(262) + (calExpanded ? CAL_DELTA : 0) + activeCardH + tabH + 24;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>

      {/* ── 스크롤 가능한 메인 콘텐츠 영역 ── */}
      <Animated.ScrollView
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentContainerStyle={{ height: scrollContentH }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >

      {/* ── 불꽃 아이콘 ── */}
      <Image
        source={FLAME_ICON}
        style={{ position: 'absolute', left: 26, top: py(108), width: 36, height: 43 }}
        resizeMode="contain"
      />

      {/* ── THIS WEEK / THIS MONTH ── */}
      <Text style={[s.onTrack, { left: 80, top: py(105) }]}>
        {calExpanded ? 'THIS MONTH' : 'THIS WEEK'}
      </Text>

      {/* ── n.nn km ── */}
      <View style={[s.streakDaysWrap, { left: 80, top: py(125), flexDirection: 'row', alignItems: 'baseline' }]}>
        <Text style={s.streakNum}>{fmtDist(calExpanded ? monthDistKm : weekDistKm)}</Text>
        <Text style={s.streakDistUnit}> km</Text>
      </View>

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
          ...radius.md,
        }}
      >
        {calExpanded ? (
          <MonthGrid
            today={todayISO}
            activitySet={activitySet}
            qualifyingSet={qualifyingSet}
            colX={colX}
            monthOffset={monthOffset}
            onPrev={() => setMonthOffset((o) => o - 1)}
            onNext={() => setMonthOffset((o) => o + 1)}
          />
        ) : (
          <WeekStrip today={todayISO} activitySet={activitySet} qualifyingSet={qualifyingSet} colX={colX} />
        )}
      </Animated.View>

      {/* ── 서킷 카드 (pace 데이터 있을 때만) ── */}
      {showCircuitCard && (
        <Animated.View
          style={{
            position: 'absolute',
            left: cardLeft,
            top: py(262),
            width: cardW,
            height: cardH,
            ...radius.lg,
            transform: [{ translateY: cardTransY }],
          }}
        >
          <Svg key={svgKey} width={cardW} height={cardH} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLG id={`hcbg_${idBase}_${svgKey}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardW} y2={cardH}>
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
              </SvgLG>
            </Defs>
            <Rect x={0.25} y={0.25} width={cardW - 0.5} height={cardH - 0.5} rx={radius.lg.borderRadius - 0.25} ry={radius.lg.borderRadius - 0.25} fill="none" stroke={`url(#hcbg_${idBase}_${svgKey})`} strokeWidth={0.5} />
          </Svg>
          <View style={{ position: 'absolute', top: 0.5, left: 0.5, right: 0.5, bottom: 0.5, borderRadius: radius.lg.borderRadius - 0.5, borderCurve: radius.lg.borderCurve, backgroundColor: CARD_FILL, overflow: 'hidden' }}>
          <Text style={s.circuitName} numberOfLines={1}>
            {circuit.displayName.toUpperCase()}
          </Text>

          <Text style={[s.statLabel, { left: 24, top: 88 }]}>DISTANCE</Text>
          <Text style={[s.statValue, { left: 24, top: 110 }]}>
            {circuit.distanceKm.toFixed(1)}km
          </Text>

          <Text style={[s.statLabel, { left: 24, top: 154 }]}>RACE TIME</Text>
          <Text style={[s.statValue, { left: 24, top: 176 }]}>{raceTimeStr}</Text>

          <Text style={[s.statLabel, { left: 24, top: 220, fontSize: 15 }]}>TYRE</Text>

          {/* TireIcon 44×41: TYRE 레이블 bottom(236) + gap(10) = top 246 */}
          <View style={{ position: 'absolute', left: 26, top: 246 }}>
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
          </View>
        </Animated.View>
      )}

      {/* ── 퀄리파잉 갱신 제안 카드 (30일 경과 시) ── */}
      {showRenewalCard && qualifyingResult && renewalNextGrade && (() => {
        const filledRatio = getFilledRatio(qualifyingResult.grade, qualifyingResult.paceSecPerKm);
        const filledWidth = Math.round(rqBarWidth * filledRatio);
        const nextTier = GRADE_TIERS.find((t) => t.grade === renewalNextGrade);
        const gapSec = nextTier ? Math.max(0, qualifyingResult.paceSecPerKm - nextTier.maxPaceSec!) : 0;
        const currentColor = GRADE_COLORS[qualifyingResult.grade];
        const nextColor = GRADE_COLORS[renewalNextGrade];
        return (
          <Animated.View
            style={{
              position: 'absolute',
              left: cardLeft,
              top: py(262),
              width: cardW,
              height: renewalCardH,
              borderRadius: 16,
              transform: [{ translateY: cardTransY }],
            }}
          >
            <Svg key={`rq-${svgKey}`} width={cardW} height={renewalCardH} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <SvgLG id={`hcbgrq_${idBase}_${svgKey}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardW} y2={renewalCardH}>
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                  <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
                  <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
                </SvgLG>
              </Defs>
              <Rect x={0.25} y={0.25} width={cardW - 0.5} height={renewalCardH - 0.5} rx={15.75} ry={15.75} fill="none" stroke={`url(#hcbgrq_${idBase}_${svgKey})`} strokeWidth={0.5} />
            </Svg>
            <View style={{ position: 'absolute', top: 0.5, left: 0.5, right: 0.5, bottom: 0.5, borderRadius: 15.5, backgroundColor: CARD_FILL, overflow: 'hidden' }}>

              {/* 제목 */}
              <Text style={s.circuitName}>Qualifying</Text>

              {/* 본문 */}
              <Text style={[s.qSubtitle, { left: 24, top: qSubtitleTop, width: cardW - 48 }]}>
                {`Time for a new lap.\nGet closer to ${GRADE_LABELS[renewalNextGrade]}.`}
              </Text>

              {/* 현재 등급 트로피 (왼쪽) */}
              <Image
                source={RENEWAL_TROPHY_IMAGES[qualifyingResult.grade]}
                style={{ position: 'absolute', left: 24, top: rqTrophyTop, width: 51, height: 52 }}
                resizeMode="contain"
              />

              {/* 다음 등급 트로피 (오른쪽) */}
              <Image
                source={RENEWAL_TROPHY_IMAGES[renewalNextGrade]}
                style={{ position: 'absolute', right: 24, top: rqTrophyTop, width: 51, height: 52 }}
                resizeMode="contain"
              />

              {/* 프로그레스 바 배경 */}
              <View style={{
                position: 'absolute', left: 24, top: rqBarTop,
                width: rqBarWidth, height: 12, borderRadius: 6,
                backgroundColor: 'rgba(255,255,255,0.1)',
              }} />

              {/* 프로그레스 바 채워진 부분 (그라데이션) */}
              <Svg style={{ position: 'absolute', left: 24, top: rqBarTop }} width={filledWidth} height={12}>
                <Defs>
                  <SvgLG id={`pgf_${idBase}`} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor={currentColor} />
                    <Stop offset="100%" stopColor={nextColor} />
                  </SvgLG>
                </Defs>
                <Rect x={0} y={0} width={filledWidth} height={12} rx={6} fill={`url(#pgf_${idBase})`} />
              </Svg>

              {/* gap 텍스트 + 점선 */}
              <View style={{ position: 'absolute', left: 24, top: rqTextTop }}>
                <GapRow
                  barWidth={rqBarWidth}
                  filledWidth={filledWidth}
                  nextGrade={renewalNextGrade}
                  gapSec={gapSec}
                  gapRowId={idBase}
                />
              </View>

              {/* START 버튼 */}
              <Pressable
                style={[s.startBtn, { width: startBtnW, top: rqStartTop }]}
                onPress={() => navigation.navigate('Qualifying')}
              >
                <Text style={s.startBtnTxt}>START</Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })()}

      {/* ── 퀄리파잉 제안 카드 (qualifyingResult 없을 때) ── */}
      {showQualifyingCard && (
        <Animated.View
          style={{
            position: 'absolute',
            left: cardLeft,
            top: py(262),
            width: cardW,
            height: qCardH,
            borderRadius: 16,
            transform: [{ translateY: cardTransY }],
          }}
        >
          <Svg key={`q-${svgKey}`} width={cardW} height={qCardH} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLG id={`hcbgq_${idBase}_${svgKey}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardW} y2={qCardH}>
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
              </SvgLG>
            </Defs>
            <Rect x={0.25} y={0.25} width={cardW - 0.5} height={qCardH - 0.5} rx={15.75} ry={15.75} fill="none" stroke={`url(#hcbgq_${idBase}_${svgKey})`} strokeWidth={0.5} />
          </Svg>
          <View style={{ position: 'absolute', top: 0.5, left: 0.5, right: 0.5, bottom: 0.5, borderRadius: 15.5, backgroundColor: CARD_FILL, overflow: 'hidden' }}>
            <Text style={s.circuitName} numberOfLines={1}>Qualifying</Text>

            <Text style={[s.qSubtitle, { left: 24, top: qSubtitleTop, width: cardW - 48 }]}>
              {'Run 1km first.\nYour interval plan follows.'}
            </Text>

            <Image
              source={QUALIFYING_TROPHY}
              style={{ position: 'absolute', left: (cardW - qImageW) / 2, top: qImageTop, width: qImageW, height: qImageH }}
              resizeMode="contain"
            />

            <Pressable
              style={[s.startBtn, { width: startBtnW, top: qCtaTop }]}
              onPress={() => navigation.navigate('Qualifying')}
            >
              <Text style={s.startBtnTxt}>START</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      </Animated.ScrollView>


      {/* ── 데브 버튼 (달린 날 테스트 데이터 토글) ── */}
      {__DEV__ && (
        <View style={{ position: 'absolute', top: safeTop + 4, right: 8, flexDirection: 'row', gap: 6, zIndex: 100 }}>
          {/* 결과 화면 미리보기 */}
          <Pressable
            onPress={() => {
              // 완주 mock 데이터 주입
              useRunStore.setState({
                distKm: 5.14,
                elapsedMs: 29 * 60 * 1000 + 14 * 1000, // 29'14"
                paceHistory: [345, 330, 320, 358, 340],  // 5 sectors (1km each)
                paceS: 341,
              });
              navigation.navigate('Result');
            }}
            style={{
              backgroundColor: '#3F5CFF',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Formula1-Bold' }}>→RESULT</Text>
          </Pressable>

          {/* 활동 날짜 토글 */}
          <Pressable
            onPress={toggleDevTest}
            style={{
              backgroundColor: devTestActive ? '#E03A3E' : '#444455',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Formula1-Bold' }}>
              {devTestActive ? 'RESET' : 'DEV'}
            </Text>
          </Pressable>
        </View>
      )}


      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop, zIndex: 1000 }}
      >
        <BlurView intensity={60} tint="dark" style={{ flex: 1 }} />
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: '#17171C',
            opacity: scrollY.interpolate({ inputRange: [0, 20], outputRange: [1, 0], extrapolate: 'clamp' }),
          }}
        />
      </View>
    </Animated.View>
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
    includeFontPadding: false,
  },
  streakDistUnit: {
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    color: '#FFFFFF',
    includeFontPadding: false,
  },

  // 서킷 카드
  circuitName: {
    position: 'absolute',
    left: 24,
    top: 24,
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
  qSubtitle: {
    position: 'absolute',
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: '#FFFFFF',
    opacity: 0.5,
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
