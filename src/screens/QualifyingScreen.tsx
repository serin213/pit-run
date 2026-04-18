import React, { useEffect, useId, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
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
import GradientCardBorder, { CARD_FILL } from '../components/GradientCardBorder';
import TextChevronButton from '../components/TextChevronButton';
import BackButton from '../components/BackButton';
import { useAppStore } from '../store/appStore';
import type { QualifyingScreenProps } from '../navigation/types';
import { useSupabaseQualifying } from '../hooks/useSupabaseQualifying';
import { useSupabaseSession } from '../hooks/useSupabaseSessions';
import { generateIntervalPlan } from '../core/intervals';
import { assignGrade } from '../lib/grading/calcGrade';
import type { QualifyingResult } from '../types';
import { insertPlan } from '../api/plans';
import { formatTime } from '../core/pace';
import { radius } from '../constants/radius';
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

const WARMUP_ICON = require('../../assets/icons/qualifying-warmup-5ce716.png');
const RUN_ICON = require('../../assets/icons/qualifying-run-756777.png');
const LICENSE_TROPHY_ICON = require('../../assets/race-trophy.png');

const RECOMMENDED_WARMUP_MINUTES = 5;
const ACCENT = '#E03A3E';

const GRADE_HINTS: Record<string, string> = {
  f1_champion: 'F1 Champion: 400m x 8, recovery 60s, target pace 3:20–3:40/km.',
  f1: 'F1: 400m x 6, recovery 90s, target pace 3:40–4:10/km.',
  f1_rookie: 'F1 Rookie: 400m x 5, recovery 90s, target pace 4:10–4:45/km.',
  f2: 'F2: 300m x 5, recovery 90–120s, target pace 4:45–5:45/km.',
  f3: 'F3: 1min run + 1min walk x 10, then repeat qualifying next week.',
};

type Phase = 'intro' | 'warmup' | 'qualifying' | 'retireConfirm';

export default function QualifyingScreen({ navigation }: QualifyingScreenProps) {
  const { setQualifyingResult } = useAppStore();
  const { saveResult } = useSupabaseQualifying();
  const { startSession, endSession } = useSupabaseSession();
  const { ensurePermission } = useLocationPermission();
  const { user } = useAuthStore();
  const [trialDistKm, setTrialDistKm] = useState(0);
  const gpsCoordsRef = useRef<LocationCoords | null>(null);
  const gpsSubRef = useRef<LocationSubscription | null>(null);
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();

  const [phase, setPhase] = useState<Phase>('intro');
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
    // Supabase 세션 시작 (비동기, 실패해도 진행)
    startSession('qualifying').catch(() => {});
  };

  const skipToQualifying = () => {
    const now = Date.now();
    setWarmupLeftSec(0);
    setTrialStartedAt(now);
    setTrialElapsedMs(0);
    setPhase('qualifying');
  };

  const finishOneKm = () => {
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
        insertPlan({
          based_on_qualifying_id: qRow?.id ?? null,
          segments: plan.segments,
        }).catch(() => {});
      })
      .catch(() => {});
    endSession({
      status: 'completed',
      total_dist_km: 1,
      total_time_ms: oneKmMs,
      avg_pace_sec_per_km: result.paceSecPerKm,
    }).catch(() => {});
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
    // Supabase 세션 포기 기록
    endSession({
      status: 'abandoned',
      total_dist_km: effectiveDistKm,
      total_time_ms: trialElapsedMs,
    }).catch(() => {});
    if (user?.id) {
      logQualifyingAbandoned({
        userId: user.id,
        elapsedMs: trialElapsedMs,
        distanceKm: effectiveDistKm,
      }).catch(() => {});
    }
    setPhase('intro');
    setWarmupLeftSec(RECOMMENDED_WARMUP_MINUTES * 60);
    setTrialStartedAt(null);
    setTrialElapsedMs(0);
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
        <BlurView intensity={60} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safeTop + 63, zIndex: 1000 }} pointerEvents="none" />
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
    <View style={st.container}>
      {/* Badge + timer grouped — 8pt gap between them */}
      <View style={[st.timerGroup, { top: badgeGroupTop }]}>
        <View style={st.labelBadge}>
          <Image
            source={isWarmup ? WARMUP_ICON : RUN_ICON}
            style={{ width: iconW, height: iconH }}
            resizeMode="contain"
          />
          <Text style={st.labelBadgeText}>
            {isWarmup ? 'Warm-up' : 'Qualifying'}
          </Text>
        </View>
        <Text
          style={[st.timerText, { fontSize: timerFontSize, marginTop: 8 }]}
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
              st.barTrack,
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
                st.barFillWrap,
                { top: barTrackTop, left: barLeft, width: barFillW, height: barH, borderRadius: barH / 2 },
              ]}
            >
              <Svg width={barFillW} height={barH}>
                <Defs>
                  <SvgLinearGradient id="qualBarGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor={ACCENT} />
                    <Stop offset="100%" stopColor="#E03A8A" />
                  </SvgLinearGradient>
                </Defs>
                <Rect x={0} y={0} width={barFillW} height={barH} rx={barH / 2} fill="url(#qualBarGrad)" />
              </Svg>
            </View>
          )}

          {/* Distance labels — 0km left-aligned, 1km right-aligned to bar */}
          <View style={[st.distLabelsRow, { top: distLabelTop, left: barLeft, width: barTrackW }]}>
            <Text style={st.distLabel} allowFontScaling={false}>0km</Text>
            <Text style={st.distLabel} allowFontScaling={false}>1km</Text>
          </View>
        </>
      )}

      {/* Bottom button — centered */}
      <View style={[st.bottomBtnWrap, { bottom: btnBottom }]}>
        {isWarmup ? (
          <TextChevronButton label="Skip" onPress={skipToQualifying} />
        ) : (
          <TextChevronButton label="Retire" onPress={confirmRetire} />
        )}
      </View>

      {/* Dev-only: finish button */}
      {__DEV__ && isQualifying && (
        <Pressable style={st.devFinishBtn} onPress={finishOneKm}>
          <Text style={st.devFinishTxt}>FINISH 1KM</Text>
        </Pressable>
      )}

      {/* Retire confirm overlay */}
      {showRetireConfirm && (
        <RetireConfirmOverlay
          onRetire={executeRetire}
          onContinue={cancelRetire}
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
  const ctaContainerH = 164;
  const ctaWidth = windowW - hPad * 2;
  const ctaHeight = 58;

  return (
    <View style={[st.container, { paddingHorizontal: hPad }]}>
      {/* Title — BackButton bottom (safeTop+39) + 24 gap = safeTop+63 */}
      <Text
        style={[st.introTitle, { marginTop: insetsTop + 63 }]}
        allowFontScaling={false}
      >
        Qualifying
      </Text>

      {/* Subtitle — gap 12 below title */}
      <Text style={st.introSubtitle} allowFontScaling={false}>
        {'Earn your license.\nGet a plan made only for you.'}
      </Text>

      {/* Step cards — gap 36 below subtitle */}
      <View style={[st.cardsWrap, { marginTop: 36, gap: 12 }]}>
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

      {/* Bottom CTA area — absolute, fade gradient + GradientCtaButton (has its own glow) */}
      <View
        style={[st.ctaContainer, { height: ctaContainerH }]}
        pointerEvents="box-none"
      >
        {/* Fade gradient: solid #17171C at bottom, transparent at top */}
        <Svg
          width={windowW}
          height={ctaContainerH}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient id="introFade" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="66%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="100%" stopColor="#17171C" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={windowW} height={ctaContainerH} fill="url(#introFade)" />
        </Svg>

        {/* GradientCtaButton — already includes glow internally */}
        <View style={[st.ctaBtnWrap, { bottom: 40 }]}>
          <GradientCtaButton
            width={ctaWidth}
            height={ctaHeight}
            label="START"
            enabled
            onPress={onStart}
          />
        </View>
      </View>
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
  const rawId = useId();
  const gradId = rawId.replace(/[^a-zA-Z0-9]/g, '_');
  const cardH = paddingV * 2 + 24;

  return (
    <View style={{ width, height: cardH, borderRadius }}>
      <Svg width={width} height={cardH} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2={cardH}>
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
            <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0.25} y={0.25} width={width - 0.5} height={cardH - 0.5} rx={borderRadius - 0.25} ry={borderRadius - 0.25} fill="none" stroke={`url(#${gradId})`} strokeWidth={0.5} />
      </Svg>
      <View style={{
        position: 'absolute', top: 0.5, left: 0.5, right: 0.5, bottom: 0.5,
        borderRadius: borderRadius - 0.5,
        backgroundColor: CARD_FILL,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: paddingHStart,
        paddingRight: paddingHEnd,
        gap: 10,
      }}>
        <Image source={icon} style={{ width: iconW, height: iconH }} resizeMode="contain" />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={st.stepCardLabel} allowFontScaling={false}>
            {label}
          </Text>
          <Text style={st.stepCardMeta} allowFontScaling={false}>
            {meta}
          </Text>
        </View>
      </View>
    </View>
  );
}

type RetireConfirmProps = {
  onRetire: () => void;
  onContinue: () => void;
};

function RetireConfirmOverlay({ onRetire, onContinue }: RetireConfirmProps) {
  const modalRadius = 24;
  const innerPad = 28;

  // Animation: slide up from bottom on mount, slide down on dismiss
  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) callback();
    });
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.retireOverlay, { opacity: overlayOpacity }]}>
      <Animated.View
        style={[
          st.retireCard,
          { borderRadius: modalRadius, transform: [{ translateY: slideAnim }], backgroundColor: 'transparent', overflow: 'hidden' },
        ]}
      >
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(32,32,40,0.35)' }]} />
        {/* Title — paddingTop:32 은 retireCard에 */}
        <Text style={[st.retireTitleText, { paddingHorizontal: innerPad }]} allowFontScaling={false}>
          Are you sure?
        </Text>

        {/* Description — title↔body: 24 */}
        <Text style={[st.retireDescText, { paddingHorizontal: innerPad, marginTop: 24 }]} allowFontScaling={false}>
          Your session will not be saved and you'll need to restart qualifying
        </Text>

        {/* Buttons row — body↔buttons: 32 */}
        <View style={[st.retireBtnsRow, { marginTop: 32 }]}>
          {/* Continue (left) */}
          <Pressable
            onPress={() => dismiss(onContinue)}
            style={[st.retireBtn, st.retireContinueBtn, radius.sm]}
          >
            <Text style={[st.retireBtnLabel, { color: '#FFFFFF' }]} allowFontScaling={false}>
              Continue
            </Text>
          </Pressable>

          {/* Retire (right) */}
          <Pressable
            onPress={() => dismiss(onRetire)}
            style={[st.retireBtn, st.retireRetireBtn, radius.sm]}
          >
            <Text style={[st.retireBtnLabel, { color: ACCENT }]} allowFontScaling={false}>
              Retire
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
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

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
  },

  // ── Intro ──
  introTitle: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    letterSpacing: 1.8,
    includeFontPadding: false,
    marginLeft: 4,
  },
  introSubtitle: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
  stepCardMeta: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    borderColor: '#FCB827',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  devFinishTxt: {
    color: '#FCB827',
    fontFamily: 'Formula1-Bold',
    fontSize: 10,
    includeFontPadding: false,
  },

  // ── Retire confirm ──
  retireOverlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  retireCard: {
    backgroundColor: '#202028',
    marginHorizontal: 20,
    marginBottom: 26,
    paddingTop: 32,
    paddingBottom: 20,
  },
  retireTitleText: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Regular',
    fontStyle: 'italic',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  retireDescText: {
    color: '#FFFFFF',
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  retireBtnsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
  },
  retireBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  retireContinueBtn: {
    backgroundColor: '#34343F',
  },
  retireRetireBtn: {
    backgroundColor: 'rgba(224,58,62,0.3)',
  },
  retireBtnLabel: {
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    letterSpacing: -0.22,
    includeFontPadding: false,
  },
});
