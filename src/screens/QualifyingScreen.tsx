import { COLORS, PALETTE } from '../constants/colors';
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
import {
  requestForegroundPermission,
  watchPosition,
  haversineKm,
  type LocationCoords,
  type LocationSubscription,
} from '../platform/location';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useAuthStore } from '../store/authStore';
import { logQualifyingCompleted, logQualifyingAbandoned } from '../lib/analytics/raceEvents';
import { playSound } from '../platform/audio';
import { successLong } from '../platform/haptics';

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
  const { setQualifyingResult, recordQualifyingDateToday } = useAppStore();
  const { saveResult } = useSupabaseQualifying();
  const { saveCompletedSession } = useSupabaseSession();
  // 시작 시점 'started' 행을 만들지 않음 — 1km 완주 자동종료 시에만 INSERT.
  // Retire는 DB와 무관하게 화면만 닫힘.
  const qualifyingStartedAtRef = useRef<string | null>(null);
  const { savePlan } = useSupabasePlans();
  const { ensurePermission } = useLocationPermission();
  const { user } = useAuthStore();
  const { isDevMode } = useDevMode();
  const [trialDistKm, setTrialDistKm] = useState(0);
  const gpsCoordsRef = useRef<LocationCoords | null>(null);
  const gpsSubRef = useRef<LocationSubscription | null>(null);
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();

  const [phase, setPhase] = useState<Phase>(skipIntro ? 'warmup' : 'intro');
  const [warmupLeftSec, setWarmupLeftSec] = useState(RECOMMENDED_WARMUP_MINUTES * 60);
  const [trialStartedAt, setTrialStartedAt] = useState<number | null>(null);
  const [trialElapsedMs, setTrialElapsedMs] = useState(0);

  // Warmup countdown
  useEffect(() => {
    if (phase !== 'warmup') return;
    const timer = setInterval(() => {
      setWarmupLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const now = Date.now();
          setTrialStartedAt(now);
          setTrialElapsedMs(0);
          setPhase('qualifying');
          return 0;
        }
        return prev - 1;
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

  // GPS 추적: qualifying 단계에서만 활성화
  useEffect(() => {
    if (phase !== 'qualifying' && phase !== 'retireConfirm') {
      gpsSubRef.current?.remove();
      gpsSubRef.current = null;
      gpsCoordsRef.current = null;
      return;
    }

    (async () => {
      const granted = await requestForegroundPermission();
      if (!granted) return;

      gpsSubRef.current = await watchPosition((coords) => {
        if (coords.accuracy != null && coords.accuracy > 20) return;
        if (gpsCoordsRef.current) {
          const dist = haversineKm(gpsCoordsRef.current, coords);
          if (dist >= 0.002 && dist <= 0.15) {
            setTrialDistKm((prev) => prev + dist);
          }
        }
        gpsCoordsRef.current = coords;
      });
    })();

    return () => {
      gpsSubRef.current?.remove();
      gpsSubRef.current = null;
    };
  }, [phase]);

  // Auto-complete when GPS distance reaches 1km
  useEffect(() => {
    if (phase === 'qualifying' && trialDistKm >= 1) {
      finishOneKm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialDistKm, phase]);

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

  const startWarmup = async () => {
    const granted = await ensurePermission();
    if (!granted) return;
    setWarmupLeftSec(RECOMMENDED_WARMUP_MINUTES * 60);
    setTrialStartedAt(null);
    setTrialElapsedMs(0);
    setPhase('warmup');
    // started_at만 메모리에 보관. DB INSERT는 1km 완주 시점에만 1회.
    qualifyingStartedAtRef.current = new Date().toISOString();
  };

  const skipToQualifying = () => {
    const now = Date.now();
    setWarmupLeftSec(0);
    setTrialStartedAt(now);
    setTrialElapsedMs(0);
    setPhase('qualifying');
  };

  const finishOneKm = () => {
    playSound('qualifyingEnd');
    successLong();
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
    // Supabase에 퀄리파잉 결과 + 세션 완료 저장 (비동기)
    saveResult({
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
      type: 'qualifying',
      started_at: qualifyingStartedAtRef.current ?? new Date().toISOString(),
      total_dist_km: 1,
      total_time_ms: oneKmMs,
      avg_pace_sec_per_km: result.paceSecPerKm,
    }).catch(() => {});
    qualifyingStartedAtRef.current = null;
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
            <View
              style={[
                styles.barFillWrap,
                { top: barTrackTop, left: barLeft, width: barFillW, height: barH, borderRadius: barH / 2 },
              ]}
            >
              <Svg width={barFillW} height={barH}>
                <Defs>
                  <SvgLinearGradient id="qualBarGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor={ACCENT} />
                    <Stop offset="100%" stopColor={PALETTE.pink} />
                  </SvgLinearGradient>
                </Defs>
                <Rect x={0} y={0} width={barFillW} height={barH} rx={barH / 2} fill="url(#qualBarGrad)" />
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
    letterSpacing: 1.8,
    includeFontPadding: false,
    marginLeft: 4,
  },
  introSubtitle: {
    color: PALETTE.white,
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
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
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
  stepCardMeta: {
    color: PALETTE.white,
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    letterSpacing: -0.34,
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
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
  timerText: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: PALETTE.white,
    fontFamily: 'Formula1-Black',
    letterSpacing: 5,
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
    letterSpacing: -0.17,
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
