import { COLORS, PALETTE } from '../constants/colors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endLiveActivity, getCurrentActivityId } from '../platform/liveActivity';
import { BlurView } from '../platform/blur';
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
import DigitColumn from '../components/result/DigitColumn';
import RollingPNumber from '../components/result/RollingPNumber';
import BarItem from '../components/result/BarItem';
import { hexToRgb, bottomRoundedRect, makeLinePaths } from '../lib/utils/svgPath';
import GradientCtaButton from '../components/GradientCtaButton';
import { CARD_FILL } from '../components/GradientCardBorder';
import ResultSharePage from './ResultSharePage';
import ScreenHeader from '../components/ScreenHeader';
import TireIcon from '../components/TireIcon';
import { useRunStore } from '../store/runStore';
import { useAppStore } from '../store/appStore';
import { calcRaceRank } from '../lib/ranking/calcRank';
import type { Tire as RankTire } from '../lib/ranking/types';
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
import { GRADE_COLORS, GRADE_DISPLAY_NAME } from '../constants/grade';
import { GRADE_TIERS } from '../lib/grading/calcGrade';
import { useSessionHistory } from '../hooks/useSessionHistory';
import { endAllLiveActivities } from '../platform/liveActivity';

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
  { id: 'too-easy' },
  { id: 'easy'     },
  { id: 'proper'   },
  { id: 'hard'     },
  { id: 'too-hard' },
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

// ─── RollingText ─────────────────────────────────────────────────────────────

interface RollingTextProps {
  target: string;
  containerStyle?: any;
  textStyle: any;
}

function RollingText({ target, containerStyle, textStyle }: RollingTextProps) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, containerStyle]}>
      <Text allowFontScaling={false} style={textStyle}>{target}</Text>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ResultScreen({ navigation, route }: ResultScreenProps) {
  // Dismiss the lock-screen Live Activity the moment the result is on screen.
  // useRunning has a 10s fallback in case the user never reaches this screen.
  React.useEffect(() => {
    const id = getCurrentActivityId();
    if (id) endLiveActivity(id).catch(() => {});
  }, []);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const safeTop    = useSafeTop();
  const safeBottom = useSafeBottom();

  const historyData = route.params?.history;
  const isHistoryMode = !!historyData;

  const runStore = useRunStore();
  const { distKm, elapsedMs, paceHistory, resetRun } = isHistoryMode
    ? { distKm: historyData.distKm, elapsedMs: historyData.elapsedMs, paceHistory: [] as number[], resetRun: () => {} }
    : runStore;

  const {
    selectedCircuitId,
    selectedTire,
    qualifyingResult,
    recordActivity,
    addDistance,
    currentRaceEventId,
    setCurrentRaceEventId,
    setSelectedCircuitId,
    activityDates,
    activePlan,
  } = useAppStore();
  const { endSession }  = useSupabaseSession();
  const { user }        = useAuthStore();
  const { sessions, load: loadSessions } = useSessionHistory();
  const [sessionsReady, setSessionsReady] = useState(false);

  // 비 히스토리 모드에서 한 번만 세션 로드
  useEffect(() => {
    if (isHistoryMode) return;
    loadSessions(200).then(() => setSessionsReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 결과 화면 진입 시 라이브 액티비티 종료 (자연 완주 + 수동 종료 모두 커버)
  useEffect(() => {
    if (isHistoryMode) return;
    endAllLiveActivities().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circuitId          = isHistoryMode ? (historyData.circuitId ?? selectedCircuitId) : selectedCircuitId;
  const circuit            = CIRCUITS.find((c) => c.id === circuitId) ?? CIRCUITS[0];
  const topTheme           = getCircuitTheme(circuit.displayName.toUpperCase());
  const themeRgb           = useMemo(() => hexToRgb(topTheme.line), [topTheme.line]);
  const circuitResultImage = CIRCUIT_RESULT_IMAGES[circuit.id] ?? null;
  const checkerFlagColor   = CHECKER_FLAG_COLOR[circuit.id] ?? null;
  const checkerFlagImage   = checkerFlagColor ? CHECKER_FLAG_IMAGES[checkerFlagColor] : null;

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalPaceS = distKm > 0 ? elapsedMs / 1000 / distKm : 0;

  // DNF when runner covers less than 98% of circuit distance
  const statusLabel = distKm >= circuit.distanceKm * 0.98 ? 'FINISH' : 'DNF';

  // ─── Commentary ───────────────────────────────────────────────────────────
  // completedAt: 화면이 마운트된 시각을 한 번만 캡처 (re-render 시 변하지 않음)
  const completedAtRef = useRef(Date.now());

  // 베타 phase 1: 글로벌은 외부 분포로, 등급별은 유저 10명 미만이면 자동 UNRANKED.
  const raceRank = (() => {
    if (isHistoryMode || !qualifyingResult || !selectedTire || totalPaceS <= 0) return null;
    // wet은 buildProgram/calcRaceRank 미지원이라 보수적으로 medium 매핑
    const tireForRank: RankTire =
      selectedTire === 'wet' ? 'medium' : (selectedTire as RankTire);
    const plannedReps = activePlan?.intervals.reps ?? 0;
    if (plannedReps <= 0) return null;
    return calcRaceRank({
      userHardAveragePaceSec: totalPaceS,
      userGrade: qualifyingResult.grade,
      circuitId: circuit.id,
      tire: tireForRank,
      completedAt: completedAtRef.current,
      completedReps: plannedReps,  // Result 도달 = 완주로 간주
      plannedReps,
      poolTotalCount: 0,
      poolGradeCount: 0,
      userRankInPool: null,
      userRankInGradePool: 1,
    });
  })();

  // 다음 등급 정보 (동기 계산)
  const { nextGradeName, nextGradePaceSec } = useMemo(() => {
    const grade = qualifyingResult?.grade;
    if (!grade) return { nextGradeName: null, nextGradePaceSec: null };
    const tierIdx = GRADE_TIERS.findIndex((t) => t.grade === grade);
    if (tierIdx <= 0) return { nextGradeName: null, nextGradePaceSec: null };
    const betterTier = GRADE_TIERS[tierIdx - 1];
    return {
      nextGradeName: GRADE_DISPLAY_NAME[betterTier.grade],
      nextGradePaceSec: betterTier.maxPaceSec,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 연속 달리기 일수 (동기 계산 — recordActivity는 홈 이동 시 호출되므로 오늘 미포함)
  const currentStreakDays = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    // 현재 런 완료 시점을 오늘로 포함
    const datesWithToday = activityDates.includes(today)
      ? activityDates
      : [...activityDates, today];
    const sorted = [...datesWithToday].sort().reverse();
    let streak = 0;
    let expected = today;
    for (const d of sorted) {
      if (d === expected) {
        streak++;
        const dt = new Date(expected + 'T00:00:00');
        dt.setDate(dt.getDate() - 1);
        expected = dt.toISOString().slice(0, 10);
      } else if (d < expected) {
        break;
      }
    }
    return streak;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // commentary state: 마운트 시 동기값으로 초기화, 세션 로드 후 1회 갱신
  const commentaryUpdatedRef = useRef(false);
  const [commentary, setCommentary] = useState(() => selectCommentary({
    completedAt:      completedAtRef.current,
    circuitId:        circuit.id,
    tire:             isHistoryMode ? null : selectedTire,
    avgPaceSec:       totalPaceS,
    sectorPaces:      paceHistory,
    isOverallPB:      false,
    isCircuitPB:      false,
    goalPaceSec:      isHistoryMode ? null : (qualifyingResult?.paceSecPerKm ?? null),
    userGrade:        qualifyingResult?.grade ?? 'f3',
    nextGradeName,
    nextGradePaceSec,
    totalRaceCount:   0,
    daysSinceLastRace: null,
    currentStreakDays,
  }));

  // 세션 로드 완료 후 PB / 횟수 / 간격 계산해서 commentary 1회 재산정
  useEffect(() => {
    if (!sessionsReady || commentaryUpdatedRef.current) return;
    commentaryUpdatedRef.current = true;

    const gpSessions = sessions.filter(
      (s) => s.type === 'grand_prix' && s.status === 'completed',
    );
    const totalRaceCount = gpSessions.length + 1;

    const prevBestOverall =
      gpSessions.length > 0
        ? Math.min(...gpSessions.map((s) => s.avg_pace_sec_per_km ?? Infinity))
        : Infinity;
    const isOverallPB = totalPaceS > 0 && totalPaceS < prevBestOverall;

    const circuitSessions = gpSessions.filter((s) => s.circuit_id === circuitId);
    const prevBestCircuit =
      circuitSessions.length > 0
        ? Math.min(...circuitSessions.map((s) => s.avg_pace_sec_per_km ?? Infinity))
        : Infinity;
    const isCircuitPB = circuitSessions.length > 0 && totalPaceS > 0 && totalPaceS < prevBestCircuit;

    const daysSinceLastRace =
      gpSessions.length > 0
        ? Math.floor(
            (Date.now() - new Date(gpSessions[0].started_at).getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : null;

    setCommentary(selectCommentary({
      completedAt:      completedAtRef.current,
      circuitId:        circuit.id,
      tire:             selectedTire,
      avgPaceSec:       totalPaceS,
      sectorPaces:      paceHistory,
      isOverallPB,
      isCircuitPB,
      goalPaceSec:      qualifyingResult?.paceSecPerKm ?? null,
      userGrade:        qualifyingResult?.grade ?? 'f3',
      nextGradeName,
      nextGradePaceSec,
      totalRaceCount,
      daysSinceLastRace,
      currentStreakDays,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsReady]);

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

  const [selectedSector, setSelectedSector] = useState(fastestSectorIdx);
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
  // ScreenHeader height estimate: safeTop + row(paddingVertical 14×2 + text ~24) + divider(4)
  const [pageHeight, setPageHeight] = useState(screenH - (safeTop + 56));
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
  // ref로 최신값 추적 — setTimeout 클로저에서 state를 못 읽는 문제 방지
  const selectedDiffRef = useRef<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const resetTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diffNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringScaleAnim   = useRef(new Animated.Value(0)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => () => {
    if (resetTimerRef.current)   clearTimeout(resetTimerRef.current);
    if (diffNavTimerRef.current) clearTimeout(diffNavTimerRef.current);
  }, []);

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
    if (isHistoryMode) {
      navigation.goBack();
      return;
    }
    // 홈 이동 + 데이터 저장을 즉시 실행, 시트 닫힘 애니메이션은 독립적으로 실행
    recordActivity();
    addDistance(distKm);
    const avgPace  = elapsedMs > 0 && distKm > 0 ? elapsedMs / 1000 / distKm : null;
    const bestPace = paceHistory.length > 0 ? Math.min(...paceHistory) : null;
    const diff = selectedDiffRef.current;
    const saves: Promise<unknown>[] = [
      endSession({
        status: 'completed',
        total_dist_km: distKm,
        total_time_ms: elapsedMs,
        avg_pace_sec_per_km: avgPace,
        best_pace_sec_per_km: bestPace,
        payload: diff ? { difficulty: diff } : undefined,
      }),
    ];
    if (user?.id && currentRaceEventId) {
      saves.push(
        logRaceCompleted({
          raceStartedEventId: currentRaceEventId,
          userId: user.id,
          completedReps: 0,
          actualHardPace: avgPace ?? 0,
          actualEasyPace: null,
          totalDurationSec: Math.round(elapsedMs / 1000),
        }),
      );
      setCurrentRaceEventId(null);
    }
    Promise.all(saves).catch(() => {});
    navigation.navigate('Home');
    resetTimerRef.current = setTimeout(() => resetRun(), 500);
    // 시트 닫힘은 fire-and-forget
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowSheet(false);
    });
  }, [
    isHistoryMode, sheetAnim, resetRun, recordActivity, addDistance, distKm, elapsedMs,
    paceHistory, endSession, user, currentRaceEventId, setCurrentRaceEventId, navigation,
  ]);

  const handleDiffSelect = useCallback((id: string) => {
    setSelectedDiff(id);
    selectedDiffRef.current = id;
    ringScaleAnim.setValue(0.5);
    ringOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(ringScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 320,
      }),
      Animated.timing(ringOpacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
    diffNavTimerRef.current = setTimeout(() => handleConfirm(), 300);
  }, [ringScaleAnim, ringOpacityAnim, handleConfirm]);

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
                  <RollingPNumber target={raceRank?.gradeRank.pNumber ?? null} color={topTheme.text} />
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
                  containerStyle={{ marginTop: 8 }}
                  textStyle={{ fontFamily: 'Formula1-Bold', fontSize: 30, color: PALETTE.white }}
                />

                <Text style={[styles.label, { marginTop: 24 }]}>AVG PACE</Text>
                <RollingText
                  target={fmtPace(totalPaceS)}
                  containerStyle={{ marginTop: 8 }}
                  textStyle={{ fontFamily: 'Formula1-Bold', fontSize: 30, color: PALETTE.white }}
                />

                <Text style={[styles.label, { marginTop: 24 }]}>TYRE</Text>
                {selectedTire && (
                  <View style={{ marginTop: 12, alignSelf: 'flex-start', marginLeft: 2, marginRight: 24 }}>
                    <TireIcon type={selectedTire} width={44} height={41} />
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
              <Stop offset="0%"  stopColor={COLORS.bg} stopOpacity="0" />
              <Stop offset="35%" stopColor={COLORS.bg} stopOpacity="1" />
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
            label={isHistoryMode ? 'Confirm' : 'To the GRID'}
            textColor={topTheme.line === PALETTE.yellow ? COLORS.bg : PALETTE.white}
            enabled
            onPress={isHistoryMode ? handleConfirm : openSheet}
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
            <View style={[StyleSheet.absoluteFill, { backgroundColor: CARD_FILL }]} />
            <Text style={styles.sheetTitle}>How was it?</Text>

            <View style={styles.emojiTrackWrap}>
              <View style={styles.emojiTrack} />
              <View style={styles.emojiRow}>
                {DIFFICULTY.map((opt) => {
                  const isSelected = selectedDiff === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      style={styles.dotHitArea}
                      onPress={() => handleDiffSelect(opt.id)}
                    >
                      {isSelected && (
                        <Animated.View
                          style={[
                            styles.dotRing,
                            {
                              backgroundColor: `rgba(${themeRgb},0.5)`,
                              opacity: ringOpacityAnim,
                              transform: [{ scale: ringScaleAnim }],
                            },
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.dotOuter,
                          isSelected && { backgroundColor: topTheme.line },
                        ]}
                      >
                        {!isSelected && <View style={styles.dotInner} />}
                      </View>
                    </Pressable>
                  );
                })}
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
    backgroundColor: COLORS.bg,
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
    color: PALETTE.white,
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
    color: COLORS.text.secondary,
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
    color: PALETTE.white,
    letterSpacing: 5,
    includeFontPadding: false,
  },
  distUnit: {
    fontFamily: 'Formula1-Regular',
    fontSize: 30,
    color: PALETTE.white,
    lineHeight: 36,
    marginBottom: 6,
  },

  // ── Shared label / value ──
  label: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: COLORS.text.secondary,
    letterSpacing: -0.26,
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
    backgroundColor: GRADE_COLORS.f1,
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
    color: GRADE_COLORS.f1,
  },
  tooltipPace: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontStyle: 'italic',
    color: PALETTE.white,
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
    color: PALETTE.white,
    letterSpacing: -0.3,
    marginBottom: 24,
    lineHeight: 36,
  },
  emojiTrackWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  emojiTrack: {
    position: 'absolute',
    left: 22,
    right: 22,
    height: 4,
    borderRadius: 100,
    backgroundColor: '#36363E',
    top: 20,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotHitArea: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#36363E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E2D33',
  },
  dotRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  emojiLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  emojiLabelEdge: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: COLORS.text.secondary,
    letterSpacing: -0.13,
  },
  emojiLabelCenter: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    color: COLORS.text.secondary,
    letterSpacing: -0.13,
  },
});
