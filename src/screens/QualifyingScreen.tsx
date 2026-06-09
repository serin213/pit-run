import { COLORS, PALETTE } from '../constants/colors';
import { LETTER_SPACING } from '../constants/typography';
import React, { useEffect, useId, useRef, useState } from 'react';
import TopSafeBlurOverlay from '../components/TopSafeBlurOverlay';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import GradientCtaButton from '../components/GradientCtaButton';
import CtaFadeBackground, { CTA_AREA_HEIGHT } from '../components/CtaFadeBackground';
import GradientCardBorder from '../components/GradientCardBorder';
import TextChevronButton from '../components/TextChevronButton';
import BackButton from '../components/BackButton';
import { useAppStore } from '../store/appStore';
import { generateUuid } from '../store/runStore';
import type { QualifyingScreenProps } from '../navigation/types';
import { useSupabaseQualifying } from '../hooks/useSupabaseQualifying';
import { useSupabaseSession } from '../hooks/useSupabaseSessions';
import { useSupabasePlans } from '../hooks/useSupabasePlans';
import { useDevMode } from '../lib/devMode';
import { generateIntervalPlan } from '../core/intervals';
import { assignGrade } from '../lib/grading/calcGrade';
import type { QualifyingResult } from '../types';
import { formatTime } from '../core/pace';
import { radius } from '../constants/radius';
import ConfirmSheet from '../components/ConfirmSheet';
import { useGPS } from '../hooks/useGPS';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { getCurrentPosition } from '../platform/location';
import {
  setActiveRacePlan,
  getActiveRacePlan,
  clearActiveRacePlan,
} from '../api/racePlan';
import { useAuthStore } from '../store/authStore';
import { logQualifyingCompleted, logQualifyingAbandoned } from '../lib/analytics/raceEvents';
import { playSound } from '../platform/audio';
import { successLong, singleImpact } from '../platform/haptics';
import {
  startLiveActivity,
  updateLiveActivity,
  endAllLiveActivities,
  getCurrentActivityId,
} from '../platform/liveActivity';

const WARMUP_ICON = require('../../assets/icons/qualifying-warmup-5ce716.png');
const RUN_ICON = require('../../assets/icons/qualifying-run-756777.png');
const LICENSE_TROPHY_ICON = require('../../assets/race-trophy.png');

const RECOMMENDED_WARMUP_MINUTES = 5;
const ACCENT = PALETTE.red;

const GRADE_HINTS: Record<string, string> = {
  f1_champion: 'F1 Champion: 400m x 8, recovery 60s, target pace 4:00–4:20/km.',
  f1: 'F1: 400m x 6, recovery 90s, target pace 4:45–5:05/km.',
  f1_rookie: 'F1 Rookie: 400m x 5, recovery 90s, target pace 5:20–5:45/km.',
  f2: 'F2: 300m x 5, recovery 90–120s, target pace 6:00–6:35/km.',
  f3: 'F3: 1min run + 1min walk x 10, then repeat qualifying next week.',
};

type Phase = 'intro' | 'warmup' | 'qualifying' | 'retireConfirm';

export default function QualifyingScreen({ navigation, route }: QualifyingScreenProps) {
  const skipIntro = route.params?.skipIntro ?? false;
  const { setQualifyingResult, recordQualifyingDateToday, recordActivity, addDistance, profile } = useAppStore();
  const { saveResult } = useSupabaseQualifying();
  const { saveCompletedSession } = useSupabaseSession();
  // 시작 시점 'started' 행을 만들지 않음 — 1km 완주 자동종료 시에만 INSERT.
  // Retire는 DB와 무관하게 화면만 닫힘.
  const qualifyingStartedAtRef = useRef<string | null>(null);
  // qualifying 세션별 stable UUID — at-least-once delivery에 의한 중복 INSERT 차단.
  // saveResult + saveCompletedSession 둘 다 같은 race를 가리키도록 별도 id 2개 사용.
  const qualifyingResultIdRef = useRef<string | null>(null);
  const qualifyingSessionIdRef = useRef<string | null>(null);
  // finishOneKm 다중 호출 방지 (root cause for duplicate qualifying rows).
  // trialDistKm useEffect deps로 [trialDistKm, phase]가 있어, GPS가 1km 넘은 이후
  // 추가 tick마다 effect 재발화 → finishOneKm 여러 번 호출 → DB INSERT 여러 번.
  // navigation.replace로 unmount되기 전에 몇 차례 더 호출되는 race condition.
  const oneKmFinishedRef = useRef(false);
  // active race plan 설정 (qualifying 모드)을 한 세션에 1회만. phase가 qualifying ↔
  // retireConfirm 토글 시 useEffect 재발화로 plan reset되어 background 사운드 다시
  // 발화하는 edge case 방지.
  const racePlanSetRef = useRef(false);
  const { savePlan } = useSupabasePlans();
  const { ensurePermission } = useLocationPermission();
  const { user } = useAuthStore();
  const { isDevMode } = useDevMode();
  const [trialDistKm, setTrialDistKm] = useState(0);
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();

  const [phase, setPhase] = useState<Phase>(skipIntro ? 'warmup' : 'intro');
  const [warmupLeftSec, setWarmupLeftSec] = useState(RECOMMENDED_WARMUP_MINUTES * 60);
  const [trialStartedAt, setTrialStartedAt] = useState<number | null>(null);
  const [trialElapsedMs, setTrialElapsedMs] = useState(0);

  // Warmup phase에 GPS warm-up — 1km 측정이 시작되는 'qualifying' 진입 전에
  // GPS chipset을 깨워두면 첫 fix 지연으로 인한 큰 delta 점프 없음.
  // (5분 warmup이라 GPS는 충분히 안정화 — 사용자 명세상 RunningScreen 진입 시 점프 제거)
  useEffect(() => {
    if (phase !== 'warmup') return;
    getCurrentPosition().catch(() => {});
  }, [phase]);

  // Warmup countdown.
  // 종료 5초 전(prev → 6일 때 새 값 5)에 'countdown' 사운드 1회 재생 (6초짜리 5,4,3,2,1,go).
  // 매초 (prev → 5,4,3,2,1) singleImpact 햅틱.
  // 0 도달 시 (qualifying 전환 시점) successLong 햅틱.
  // skipToQualifying은 이 effect를 거치지 않으므로 사운드/햅틱 트리거 안 됨.
  useEffect(() => {
    if (phase !== 'warmup') return;
    const timer = setInterval(() => {
      setWarmupLeftSec((prev) => {
        const next = prev - 1;
        if (prev === 6) {
          // 정확히 5초 남은 시점 → CountdownScreen과 동일 6초 사운드 시작
          playSound('countdown');
        }
        if (next >= 1 && next <= 5) {
          singleImpact();
        }
        if (prev <= 1) {
          clearInterval(timer);
          successLong();
          const now = Date.now();
          setTrialStartedAt(now);
          setTrialElapsedMs(0);
          setPhase('qualifying');
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Trial stopwatch — continues during retireConfirm so timer keeps ticking behind the sheet
  useEffect(() => {
    if ((phase !== 'qualifying' && phase !== 'retireConfirm') || trialStartedAt == null) return;
    const timer = setInterval(() => {
      setTrialElapsedMs(Date.now() - trialStartedAt);
    }, 100);
    return () => clearInterval(timer);
  }, [phase, trialStartedAt]);

  // GPS 추적: qualifying 단계에서만 활성화. useGPS hook이 RunningScreen과
  // 동일한 background task + polling + 임계값(accuracy 50m) 사용. 호출부는
  // 누적 콜백만 제공 (qualifying은 local state, race는 store에 누적).
  // 'qualifying' ↔ 'retireConfirm' 토글 시 boolean이 동일해서 effect cycle 안 끊김.
  const isGpsActive = phase === 'qualifying' || phase === 'retireConfirm';
  useGPS(isGpsActive, (d) => setTrialDistKm((prev) => prev + d));

  // Auto-complete when GPS distance reaches 1km
  useEffect(() => {
    if (phase === 'qualifying' && trialDistKm >= 1) {
      finishOneKm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialDistKm, phase]);

  // phase가 'qualifying'으로 진입할 때 active race plan을 'qualifying' 모드로 설정.
  // background location task가 이 plan을 읽어 1km 도달 시 qualifyingEnd 사운드를
  // 잠금/백그라운드 상태에서도 발화 (race의 boxbox/fullPush와 동일 메커니즘).
  // racePlanSetRef로 세션당 1회만 set — retireConfirm ↔ qualifying 토글 시 reset 방지.
  useEffect(() => {
    if (phase !== 'qualifying') return;
    if (racePlanSetRef.current) return;
    racePlanSetRef.current = true;
    // FIX 2: qualifying 시작 시점 plan 값 진단 로그.
    console.warn('[RaceStart] setActiveRacePlan:', JSON.stringify({
      intervalKm: 1,
      lastBoxBoxAtKm: 0,
      maxReps: 1,
      recoveryDurationMs: 0,
      mode: 'qualifying',
    }));
    {
      const nowMs = Date.now();
      setActiveRacePlan({
        mode: 'qualifying',
        isRunning: true,
        isPaused: false,
        startedAtMs: nowMs,
        intervalKm: 1,
        recoveryDurationMs: 0,
        maxReps: 1,
        lastBoxBoxAtKm: 0,
        completedReps: 0,
        nextFullPushAtMs: null,
        // 묶음 2: qualifying은 boxbox/fullPush 분기 안 탐. lap timing 필드는 race 전용
        // 이지만 ActiveRacePlan 타입을 단일화 유지하기 위해 null/now로 채움.
        lastFiredAt: null,
        lastFiredAtMs: null,
        workStartedAtMs: nowMs,
        workStartedAtKm: 0,
        pitStartedAtMs: null,
        pitStartedAtKm: null,
      });
    }
  }, [phase]);

  // Dev-only: simulate distance increasing over time (1km in 30s)
  const [simDistKm, setSimDistKm] = useState(0);
  useEffect(() => {
    if (!__DEV__ || (phase !== 'qualifying' && phase !== 'retireConfirm')) {
      setSimDistKm(0);
      return;
    }
    const SIM_DURATION_MS = 30_000;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const dist = Math.min(1, (Date.now() - startedAt) / SIM_DURATION_MS);
      setSimDistKm(dist);
    }, 200);
    return () => clearInterval(timer);
  }, [phase]);

  const effectiveDistKm = __DEV__ ? simDistKm : trialDistKm;

  // Live Activity는 startWarmup에서 mode='warmup'으로 시작. 이후 phase가
  // 'qualifying'으로 전환되면 같은 LA를 update만 호출하여 mode='qualifying'으로
  // 즉시 전환 (1초 interval 기다리지 않게 명시적으로 fire).
  //
  // LA update interval (1초)의 mode 결정은 phase 기반:
  //   - warmup     → mode 'warmup',     elapsedMs = warmupLeftSec*1000 (카운트다운)
  //   - qualifying → mode 'qualifying', elapsedMs = trialElapsedMs (경과)
  //   - retireConfirm → mode 'qualifying' (qualifying view 유지)
  //
  // closure stale 방어 위해 trial 데이터와 warmupLeftSec 둘 다 ref에 보관.
  const trialStatsRef = useRef({ elapsedMs: 0, distKm: 0 });
  const warmupLeftSecRef = useRef(RECOMMENDED_WARMUP_MINUTES * 60);
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    trialStatsRef.current = { elapsedMs: trialElapsedMs, distKm: effectiveDistKm };
  }, [trialElapsedMs, effectiveDistKm]);
  useEffect(() => {
    warmupLeftSecRef.current = warmupLeftSec;
  }, [warmupLeftSec]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // phase가 'warmup'으로 바뀌면 LA 시작 — 빌드 28의 검증된 useEffect 패턴.
  // startWarmup 함수 안에서 직접 호출하던 빌드 30 방식은 release 빌드에서
  // module instantiation이 일어나지 않아 LA가 안 뜸. effect 기반으로 복원.
  useEffect(() => {
    if (phase !== 'warmup') return;
    if (getCurrentActivityId()) return;
    // teamColor는 사용자 프로필의 nameTagAccentColor 전달. Swift LockWaveView
     // ("Well done, mate")가 이 값을 사용해서 파형 색상으로 표시.
     // (qualifying의 다른 UI — warmup/progress bar/DI 버튼 — 은 Swift에서
     //  hardcoded red 유지. attributes.teamColor는 wave에서만 활용.)
    startLiveActivity(
      profile.displayName,
      profile.nameTagAccentColor,
      'qualifying',
      'warmup',
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // warmup → qualifying 전환 시 LA mode를 즉시 update (interval 1초 기다리지 않게).
  const prevPhaseRef = useRef<Phase>(phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === 'warmup' && phase === 'qualifying') {
      const id = getCurrentActivityId();
      if (!id) return;
      updateLiveActivity(id, {
        distKm: 0,
        elapsedMs: 0,
        paceS: 0,
        sector: 'red',
        tire: 'soft',
        pitPhase: 'none',
        prog: 0,
        isPaused: false,
        mode: 'qualifying',
      });
    }
  }, [phase]);

  // LA 주기적 업데이트. phase가 warmup/qualifying/retireConfirm일 때 활성.
  const isLaActive = phase === 'warmup' || phase === 'qualifying' || phase === 'retireConfirm';
  useEffect(() => {
    if (!isLaActive) return;
    const interval = setInterval(() => {
      const id = getCurrentActivityId();
      if (!id) return;
      const p = phaseRef.current;
      if (p === 'warmup') {
        // warmup: elapsedMs = 남은 시간 ms
        updateLiveActivity(id, {
          distKm: 0,
          elapsedMs: Math.max(0, warmupLeftSecRef.current * 1000),
          paceS: 0,
          sector: 'red',
          tire: 'soft',
          pitPhase: 'none',
          prog: 0,
          isPaused: false,
          mode: 'warmup',
        });
      } else if (p === 'qualifying' || p === 'retireConfirm') {
        const { elapsedMs, distKm } = trialStatsRef.current;
        updateLiveActivity(id, {
          distKm: 0,
          elapsedMs: Math.round(elapsedMs),
          paceS: 0,
          sector: 'red',
          tire: 'soft',
          pitPhase: 'none',
          prog: Math.max(0, Math.min(1, distKm)),
          isPaused: false,
          mode: 'qualifying',
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLaActive]);

  const startWarmup = async () => {
    const granted = await ensurePermission();
    if (!granted) return;
    setWarmupLeftSec(RECOMMENDED_WARMUP_MINUTES * 60);
    setTrialStartedAt(null);
    setTrialElapsedMs(0);
    setPhase('warmup');
    // started_at만 메모리에 보관. DB INSERT는 1km 완주 시점에만 1회.
    qualifyingStartedAtRef.current = new Date().toISOString();
    // qualifying 세션별 stable UUID — at-least-once delivery 중복 차단용.
    // qualifying_results와 run_sessions가 별도 row라 id도 별도.
    qualifyingResultIdRef.current = generateUuid();
    qualifyingSessionIdRef.current = generateUuid();
    oneKmFinishedRef.current = false; // 새 세션 시작 — guard 초기화
    racePlanSetRef.current = false; // 새 세션 시작 — race plan setup 재허용
    // LA 시작은 별도 useEffect (phase deps)가 처리 — 빌드 28의 검증된 패턴.
  };

  const skipToQualifying = () => {
    const now = Date.now();
    setWarmupLeftSec(0);
    setTrialStartedAt(now);
    setTrialElapsedMs(0);
    setPhase('qualifying');
    // warmup 카운트다운을 건너뛰는 케이스 — phase transition effect도 이걸로 trigger되지만,
    // 명시적으로 즉시 mode='qualifying'로 업데이트해서 LA 화면 즉시 전환.
    const id = getCurrentActivityId();
    if (id) {
      updateLiveActivity(id, {
        distKm: 0,
        elapsedMs: 0,
        paceS: 0,
        sector: 'red',
        tire: 'soft',
        pitPhase: 'none',
        prog: 0,
        isPaused: false,
        mode: 'qualifying',
      });
    }
  };

  const finishOneKm = () => {
    if (oneKmFinishedRef.current) return; // idempotent guard
    oneKmFinishedRef.current = true;
    // background task가 이미 qualifyingEnd 사운드를 발화했는지 확인 (mode='qualifying'
    // + completedReps>0). 발화했으면 foreground 중복 재생 방지. 햅틱은 어차피
    // background에서 동작 안 하므로 항상 실행.
    const planAtFinish = getActiveRacePlan();
    const bgAlreadyFiredSound =
      planAtFinish?.mode === 'qualifying' && planAtFinish.completedReps > 0;
    if (!bgAlreadyFiredSound) {
      playSound('qualifyingEnd');
    }
    successLong();
    // plan은 더 이상 필요 없음. 다음 background tick에서 무관해지도록 정리.
    clearActiveRacePlan();
    const oneKmMs = Math.max(1000, trialElapsedMs);
    const paceSecPerKm = oneKmMs / 1000;
    const gradeAssignment = assignGrade(paceSecPerKm, Date.now());
    const result: QualifyingResult = {
      warmupMinutes: RECOMMENDED_WARMUP_MINUTES,
      oneKmMs,
      paceSecPerKm,
      grade: gradeAssignment.grade,
      nextIntervalHint: GRADE_HINTS[gradeAssignment.grade],
      qualifiedAt: Date.now(),
    };
    setQualifyingResult(result);
    // 캘린더 pill / qual icon 즉시 반영 위해 로컬 qualifyingDates에 오늘 추가
    recordQualifyingDateToday();
    // History TOTAL/ON TRACK 통계 — race 결과 화면처럼 qualifying 1km 완주도 누적.
    // 이전엔 ResultScreen에서만 호출 → qualifying만 한 사용자는 영원히 0km/0days.
    recordActivity();
    addDistance(1);
    // Supabase에 퀄리파잉 결과 + 세션 완료 저장 (비동기)
    // qualifyingResultIdRef는 startWarmup에서 1회 생성된 stable UUID.
    // withRetry 재시도 중복 + finishOneKm 재호출 race condition 모두 upsert로 차단.
    saveResult({
      id: qualifyingResultIdRef.current ?? undefined,
      one_km_ms: oneKmMs,
      pace_sec_per_km: result.paceSecPerKm,
      grade: result.grade,
      warmup_minutes: result.warmupMinutes,
    })
      .then((qRow) => {
        // 퀄리파잉 결과 저장 후 인터벌 플랜도 저장
        const plan = generateIntervalPlan(result.grade, result.paceSecPerKm);
        savePlan({
          based_on_qualifying_id: qRow?.id ?? null,
          segments: plan.segments,
        }).catch(() => {});
      })
      .catch(() => {});
    // 1km GPS 완주가 확정된 이 시점에만 run_sessions 행 INSERT.
    // started_at는 startWarmup 시점에 캡쳐했던 ISO를 그대로 사용 (없으면 now).
    saveCompletedSession({
      id: qualifyingSessionIdRef.current ?? undefined,
      type: 'qualifying',
      started_at: qualifyingStartedAtRef.current ?? new Date().toISOString(),
      total_dist_km: 1,
      total_time_ms: oneKmMs,
      avg_pace_sec_per_km: result.paceSecPerKm,
    }).catch(() => {});
    qualifyingStartedAtRef.current = null;
    // LA를 'completed' 상태로 update — Swift View에서 qualifying mode + completed
    // pitPhase 조합을 "Well done, mate" wave view로 분기. QualifyingPostScreen에서
    // unmount 시점에 종료. (이전엔 PostScreen mount 즉시 endAll로 well done LA를
    // 한 번도 안 보였음.)
    const activityId = getCurrentActivityId();
    if (activityId) {
      updateLiveActivity(activityId, {
        distKm: 1,
        elapsedMs: oneKmMs,
        paceS: Math.round(result.paceSecPerKm),
        // 묶음 1b-LA: LA color는 attributes.teamColor가 결정. state.sector는 dummy
        // 'yellow' 통일 (Swift LockNormalView에서 색상 결정엔 미사용, 호환성 prop).
        sector: 'red',
        tire: 'soft',
        pitPhase: 'completed',
        prog: 1,
        isPaused: false,
        mode: 'qualifying',
      }).catch(() => {});
    }
    if (user?.id) {
      logQualifyingCompleted({
        userId: user.id,
        grade: result.grade,
        paceSecPerKm: result.paceSecPerKm,
        oneKmMs,
      }).catch(() => {});
    }
    navigation.replace('QualifyingPost');
  };

  const confirmRetire = () => {
    setPhase('retireConfirm');
  };

  const cancelRetire = () => {
    setPhase('qualifying');
  };

  const executeRetire = () => {
    // Retire = 1km 미완주. 시작 시점에 DB 행을 만들지 않으므로 삭제할 것도 없음.
    // history/DB 모두 무관 — 분석 이벤트만 기록.
    // Live Activity는 navigation.goBack()으로 빠지면 QualifyingPostScreen으로
    // 안 가므로 여기서 직접 종료. (Post에는 자동완주 케이스에서만 도달.)
    endAllLiveActivities().catch(() => {});
    clearActiveRacePlan(); // background task가 더 이상 qualifyingEnd 발화 안 하게
    qualifyingStartedAtRef.current = null;
    if (user?.id) {
      logQualifyingAbandoned({
        userId: user.id,
        elapsedMs: trialElapsedMs,
        distanceKm: effectiveDistKm,
      }).catch(() => {});
    }
    navigation.goBack();
  };

  const timerFontSize = 120;

  // --- INTRO ---
  if (phase === 'intro') {
    return (
      <View style={{ flex: 1 }}>
        <IntroScreen
          windowW={windowW}
          insetsTop={safeTop}
          onStart={startWarmup}
        />
        {/* BackButton rendered last so it appears above content */}
        <BackButton onPress={() => navigation.goBack()} />
        <TopSafeBlurOverlay safeTop={safeTop} />
      </View>
    );
  }

  // --- WARMUP & QUALIFYING (shared container) ---
  const isWarmup = phase === 'warmup';
  const isQualifying = phase === 'qualifying' || phase === 'retireConfirm';
  const showRetireConfirm = phase === 'retireConfirm';

  // Layout constants
  const btnBottom = 55;

  const iconH = isWarmup ? 21 : 20;
  const iconW = 18;

  // Badge + timer group: badge at top, timer 8pt below
  const badgeGroupTop = safeTop + 164;
  const badgeHeight = 32; // paddingVertical 4×2 + lineHeight 24
  const timerLineHeight = timerFontSize * 1.2;
  const timerGroupBottom = badgeGroupTop + badgeHeight + 8 + timerLineHeight;

  // Progress bar — fixed 24pt margins from screen edges
  const barH = 12;
  const barLeft = 24;
  const barTrackW = windowW - 48;
  const barFillW = Math.round(barTrackW * Math.min(1, Math.max(0, effectiveDistKm)));
  const barTrackTop = Math.max(465, Math.round(timerGroupBottom + 64));
  const distLabelTop = barTrackTop + barH + 8;

  return (
    <View style={styles.container}>
      {/* Badge + timer grouped — 8pt gap between them */}
      <View style={[styles.timerGroup, { top: badgeGroupTop }]}>
        <View style={styles.labelBadge}>
          <Image
            source={isWarmup ? WARMUP_ICON : RUN_ICON}
            style={{ width: iconW, height: iconH }}
            resizeMode="contain"
          />
          <Text style={styles.labelBadgeText}>
            {isWarmup ? 'Warm-up' : 'Qualifying'}
          </Text>
        </View>
        <Text
          style={[styles.timerText, { fontSize: timerFontSize, marginTop: 8 }]}
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {isWarmup ? fmtClock(warmupLeftSec) : fmtQualTime(trialElapsedMs)}
        </Text>
      </View>

      {/* Progress bar — qualifying only */}
      {isQualifying && (
        <>
          <View
            style={[
              styles.barTrack,
              {
                top: barTrackTop,
                left: barLeft,
                width: barTrackW,
                height: barH,
                borderRadius: barH / 2,
              },
            ]}
          />
          {barFillW > 0 && (
            // LA의 Capsule clip 패턴과 동일:
            // - wrap은 트랙 전체 폭(barTrackW) + borderRadius로 알약 모양 + overflow:hidden
            // - 내부 SVG는 left부터 width=barFillW로 fill 영역만 그림 (rx 없음 = 직사각형)
            // - wrap의 알약 마스크가 fill의 왼쪽 곡선만 자연스럽게 노출, 오른쪽은
            //   barFillW 지점에서 직선으로 끝남
            // 이전엔 wrap width를 barFillW로 줘서 작은 fill일 때 양쪽 둥근 독립 알약처럼 보였음
            <View
              style={[
                styles.barFillWrap,
                { top: barTrackTop, left: barLeft, width: barTrackW, height: barH, borderRadius: barH / 2 },
              ]}
            >
              <Svg width={barFillW} height={barH}>
                <Defs>
                  <SvgLinearGradient id="qualBarGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor={ACCENT} />
                    <Stop offset="100%" stopColor={PALETTE.pink} />
                  </SvgLinearGradient>
                </Defs>
                <Rect x={0} y={0} width={barFillW} height={barH} fill="url(#qualBarGrad)" />
              </Svg>
            </View>
          )}

          {/* Distance labels — 0km left-aligned, 1km right-aligned to bar */}
          <View style={[styles.distLabelsRow, { top: distLabelTop, left: barLeft, width: barTrackW }]}>
            <Text style={styles.distLabel} allowFontScaling={false}>0km</Text>
            <Text style={styles.distLabel} allowFontScaling={false}>1km</Text>
          </View>
        </>
      )}

      {/* Bottom button — centered */}
      <View style={[styles.bottomBtnWrap, { bottom: btnBottom }]}>
        {isWarmup ? (
          <TextChevronButton label="Skip" onPress={skipToQualifying} />
        ) : (
          <TextChevronButton label="Retire" onPress={confirmRetire} />
        )}
      </View>

      {/* Dev-only: finish button */}
      {isDevMode && isQualifying && (
        <Pressable style={styles.devFinishBtn} onPress={finishOneKm}>
          <Text style={styles.devFinishTxt}>FINISH 1KM</Text>
        </Pressable>
      )}

      {/* Retire confirm overlay */}
      {showRetireConfirm && (
        <ConfirmSheet
          title="Are you sure?"
          description="Your session will not be saved and you'll need to restart qualifying"
          secondaryLabel="Continue"
          primaryLabel="Retire"
          onSecondary={cancelRetire}
          onPrimary={executeRetire}
        />
      )}

    </View>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

type IntroScreenProps = {
  windowW: number;
  insetsTop: number;
  onStart: () => void;
};

function IntroScreen({ windowW, insetsTop, onStart }: IntroScreenProps) {
  const cardBorderRadius = radius.sm.borderRadius;
  const cardPaddingV = 12;
  const cardPaddingHEnd = 18;
  const cardPaddingHStart = 16;
  const hPad = 20;
  const ctaContainerH = CTA_AREA_HEIGHT;
  const ctaWidth = windowW - hPad * 2;
  const ctaHeight = 58;

  return (
    <View style={[styles.container, { paddingHorizontal: hPad }]}>
      {/* Title — BackButton bottom (safeTop+39) + 24 gap = safeTop+63 */}
      <Text
        style={[styles.introTitle, { marginTop: insetsTop + 63 }]}
        allowFontScaling={false}
      >
        Qualifying
      </Text>

      {/* Subtitle — gap 12 below title */}
      <Text style={styles.introSubtitle} allowFontScaling={false}>
        {'Earn your license.\nGet a plan made only for you.'}
      </Text>

      {/* Step cards — gap 36 below subtitle */}
      <View style={[styles.cardsWrap, { marginTop: 36, gap: 12 }]}>
        <StepCard
          icon={WARMUP_ICON}
          iconW={20}
          iconH={24}
          label="Warm-up"
          meta="5min"
          borderRadius={cardBorderRadius}
          paddingV={cardPaddingV}
          paddingHStart={cardPaddingHStart}
          paddingHEnd={cardPaddingHEnd}
          width={windowW - hPad * 2}
        />
        <StepCard
          icon={RUN_ICON}
          iconW={20}
          iconH={23}
          label="Run 1km"
          meta="Auto-start"
          borderRadius={cardBorderRadius}
          paddingV={cardPaddingV}
          paddingHStart={cardPaddingHStart}
          paddingHEnd={cardPaddingHEnd}
          width={windowW - hPad * 2}
        />
        <StepCard
          icon={LICENSE_TROPHY_ICON}
          iconW={23}
          iconH={24}
          label="Get License"
          meta="Level & Plan"
          borderRadius={cardBorderRadius}
          paddingV={cardPaddingV}
          paddingHStart={cardPaddingHStart}
          paddingHEnd={cardPaddingHEnd}
          width={windowW - hPad * 2}
        />
      </View>

      {/* Bottom CTA area — fade gradient + GradientCtaButton (has its own glow) */}
      <CtaFadeBackground height={ctaContainerH}>
        <View style={[styles.ctaBtnWrap, { bottom: 40 }]}>
          <GradientCtaButton
            width={ctaWidth}
            height={ctaHeight}
            label="START"
            enabled
            onPress={onStart}
          />
        </View>
      </CtaFadeBackground>
    </View>
  );
}

type StepCardProps = {
  icon: ImageSourcePropType;
  iconW: number;
  iconH: number;
  label: string;
  meta: string;
  borderRadius: number;
  paddingV: number;
  paddingHStart: number;
  paddingHEnd: number;
  width: number;
};

function StepCard({
  icon, iconW, iconH, label, meta,
  borderRadius, paddingV, paddingHStart, paddingHEnd, width,
}: StepCardProps) {
  const cardH = paddingV * 2 + 24;

  return (
    <GradientCardBorder
      style={{ width, height: cardH }}
      innerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: paddingHStart,
        paddingRight: paddingHEnd,
        gap: 10,
      }}
      borderRadius={borderRadius}
    >
      <Image source={icon} style={{ width: iconW, height: iconH }} resizeMode="contain" />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.stepCardLabel} allowFontScaling={false}>
          {label}
        </Text>
        <Text style={styles.stepCardMeta} allowFontScaling={false}>
          {meta}
        </Text>
      </View>
    </GradientCardBorder>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmtClock(totalSec: number): string {
  return formatTime(totalSec * 1000);
}

function fmtQualTime(ms: number): string {
  return formatTime(ms);
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // ── Intro ──
  introTitle: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    letterSpacing: LETTER_SPACING.caption(36),
    includeFontPadding: false,
    marginLeft: 4,
  },
  introSubtitle: {
    color: PALETTE.white,
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: LETTER_SPACING.display(20),
    marginTop: 12,
    includeFontPadding: false,
  },
  cardsWrap: {
    width: '100%',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  stepCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepCardLabel: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    letterSpacing: LETTER_SPACING.display(20),
    includeFontPadding: false,
  },
  stepCardMeta: {
    color: PALETTE.white,
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    letterSpacing: LETTER_SPACING.display(17),
    includeFontPadding: false,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  ctaBtnWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },

  // ── Warmup / Qualifying ──
  timerGroup: {
    position: 'absolute',
    left: 36,
    right: 36,
    alignItems: 'center',
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(224,58,62,0.3)',
    borderRadius: 2,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  labelBadgeText: {
    color: ACCENT,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: LETTER_SPACING.display(20),
    includeFontPadding: false,
  },
  timerText: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: PALETTE.white,
    fontFamily: 'Formula1-Black',
    letterSpacing: LETTER_SPACING.caption(100),
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  barFillWrap: {
    position: 'absolute',
    overflow: 'hidden',
  },
  distLabel: {
    color: PALETTE.white,
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    letterSpacing: LETTER_SPACING.display(17),
    includeFontPadding: false,
  },
  distLabelsRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomBtnWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // ── Dev ──
  devFinishBtn: {
    position: 'absolute',
    top: 44,
    left: 16,
    backgroundColor: 'rgba(252,184,39,0.2)',
    borderWidth: 1,
    borderColor: PALETTE.yellow,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  devFinishTxt: {
    color: PALETTE.yellow,
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
    includeFontPadding: false,
  },

});
