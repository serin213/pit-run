import { PALETTE } from '../constants/colors';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from '../platform/gradient';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import GradientCtaButton from '../components/GradientCtaButton';
import { useAppStore } from '../store/appStore';
import { formatPace } from '../core/pace';
import type { QualifyingPostScreenProps } from '../navigation/types';
import type { QualifyingGrade } from '../types';
import { GRADE_COLORS } from '../constants/grade';

// ─── Grade text images ────────────────────────────────────────────────────────

type GradeImageInfo = {
  source: ReturnType<typeof require>;
  width: number;
  height: number;
  /** Lottie 하단 공백 + PNG 상단 투명 패딩 보정 → trophy bottom ↔ text content top = 28pt */
  gradeTextMarginTop: number;
  /** PNG 하단 투명 패딩 보정 → text content bottom ↔ GLOBAL RANK = 28pt */
  statsMarginTop: number;
};

// Lottie: center trophy bottom = 195pt, comp height = 243pt → 48pt 하단 공백
// gradeTextMarginTop = 28 − 48 + pad_top_pt
// statsMarginTop     = 28 − pad_bottom_pt
const GRADE_TEXT_IMAGES: Record<QualifyingGrade, GradeImageInfo> = {
  f3:          { source: require('../../assets/qualifying/text/f3.png'),          width:  98.5, height:  54,    gradeTextMarginTop: -2, statsMarginTop: 58},
  f2:          { source: require('../../assets/qualifying/text/f2.png'),          width: 103.8, height:  54,    gradeTextMarginTop: -2, statsMarginTop: 58},
  f1:          { source: require('../../assets/qualifying/text/f1.png'),          width:  98,   height:  54,    gradeTextMarginTop: -2, statsMarginTop: 58},
  f1_rookie:   { source: require('../../assets/qualifying/text/f1-rookie.png'),   width: 136.4, height:  92.51, gradeTextMarginTop: -2, statsMarginTop: 58},
  f1_champion: { source: require('../../assets/qualifying/text/f1-champion.png'), width: 205.4, height:  92.69, gradeTextMarginTop: -2, statsMarginTop: 58},
};

// ─── Grade-specific CTA colors ───────────────────────────────────────────────

type CtaTheme = { gradientStart: string; gradientEnd: string; textColor: string };

const CTA_THEME: Record<QualifyingGrade, CtaTheme> = {
  f3:          { gradientStart: GRADE_COLORS.f1_champion, gradientEnd: '#FF4D51', textColor: PALETTE.white },
  f2:          { gradientStart: GRADE_COLORS.f2,          gradientEnd: '#FFBE35', textColor: '#17171C' },
  f1_rookie:   { gradientStart: GRADE_COLORS.f1_rookie,   gradientEnd: '#50C736', textColor: PALETTE.white },
  f1:          { gradientStart: GRADE_COLORS.f1,          gradientEnd: '#8C29CF', textColor: PALETTE.white },
  f1_champion: { gradientStart: GRADE_COLORS.f1_champion, gradientEnd: '#FF4D51', textColor: PALETTE.white },
};

const GLOBE = require('../../assets/qualifying/globe.png');

// ─── Grade-specific Lottie sources ───────────────────────────────────────────

const LOTTIE_SOURCE: Record<QualifyingGrade, AnimationObject> = {
  f3:          require('../../assets/qualifying/lottie/f3.json'),
  f2:          require('../../assets/qualifying/lottie/f2.json'),
  f1_rookie:   require('../../assets/qualifying/lottie/f1-rookie.json'),
  f1:          require('../../assets/qualifying/lottie/f1.json'),
  f1_champion: require('../../assets/qualifying/lottie/f1-champion.json'),
};

const CONFETTI_SOURCE = require('../../assets/qualifying/lottie/confetti.json');

// confetti comp 1200×1200, 원 반지름 ~30.5pt → 15px 표시 → scale = 15/(2×30.5) ≈ 0.246
// 렌더 사이즈 = 1200 × 0.246 ≈ 295pt
const CONFETTI_SIZE = 295;

const GRADE_ORDER: QualifyingGrade[] = ['f3', 'f2', 'f1', 'f1_rookie', 'f1_champion'];
const GRADE_LABELS_SHORT: Record<QualifyingGrade, string> = {
  f3: 'F3', f2: 'F2', f1: 'F1', f1_rookie: 'ROOKIE', f1_champion: 'CHAMP',
};

export default function QualifyingPostScreen({ navigation, route }: QualifyingPostScreenProps) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const historyData = route.params?.history;
  const isHistoryMode = !!historyData;

  const qualifyingResult = useAppStore((s) => s.qualifyingResult);
  const [devGrade, setDevGrade] = useState<QualifyingGrade | null>(null);
  const grade = (__DEV__ && devGrade) ? devGrade : (historyData?.grade ?? qualifyingResult?.grade ?? 'f3');
  const ctaTheme = CTA_THEME[grade];
  const gradeImg = GRADE_TEXT_IMAGES[grade];

  const gradeTextOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef<LottieView>(null);

  // grade 변경 시 opacity 초기화 + 텍스트 즉시 fade in
  useEffect(() => {
    gradeTextOpacity.setValue(0);
    statsOpacity.setValue(0);
    ctaOpacity.setValue(0);
    confettiOpacity.setValue(0);

    Animated.timing(gradeTextOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // 0.8초 후: 콘페티 + 성적 + CTA 동시 fade in
    const timer = setTimeout(() => {
      confettiRef.current?.play();
      Animated.timing(confettiOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      Animated.timing(statsOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }, 800);

    return () => clearTimeout(timer);
  }, [grade]);

  const handleAnimationFinish = () => {};

  const timeStr = historyData
    ? formatPace(historyData.paceSec)
    : qualifyingResult
      ? formatPace(qualifyingResult.paceSecPerKm)
      : `—'——"`;

  return (
    <View style={styles.root}>
      {/* [DEV] 등급 전환 버튼 */}
      {__DEV__ && (
        <View style={[styles.devBar, { top: safeTop + 8 }]}>
          {GRADE_ORDER.map((g) => (
            <Pressable
              key={g}
              onPress={() => setDevGrade(g)}
              style={[styles.devBtn, grade === g && styles.devBtnActive]}
            >
              <Text style={[styles.devBtnText, grade === g && styles.devBtnTextActive]}>
                {GRADE_LABELS_SHORT[g]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Lottie 트로피 애니메이션 */}
      <View style={[styles.lottieWrap, { marginTop: safeTop + 84 }]}>
        <LottieView
          key={grade}
          source={LOTTIE_SOURCE[grade]}
          style={styles.lottie}
          autoPlay
          loop={false}
          onAnimationFinish={handleAnimationFinish}
          resizeMode="contain"
        />
      </View>

      {/* Globe 배경 — center trophy bottom(safeTop+84+195) + 12 */}
      <View
        style={[styles.globeWrap, { top: safeTop + 291 }]}
        pointerEvents="none"
      >
        <Image source={GLOBE} style={[styles.globe, { opacity: 0.5 }]} resizeMode="contain" />
      </View>

      {/* 하단 그라데이션 — globe 하단 페이드 + CTA 배경 */}
      <LinearGradient
        colors={['transparent', '#17171C']}
        style={[styles.bottomGradient, { width: windowW, height: windowH * 0.45, bottom: 0 }]}
        pointerEvents="none"
      />

      {/* 등급 텍스트 이미지 — 글로우 시작 시 fade in */}
      <Animated.View style={[styles.gradeTextWrap, { marginTop: gradeImg.gradeTextMarginTop, opacity: gradeTextOpacity }]}>
        <Image
          source={gradeImg.source}
          style={{ width: gradeImg.width, height: gradeImg.height }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* 성적 — 애니메이션 종료 후 fade in */}
      <Animated.View style={[styles.statsWrap, { marginTop: gradeImg.statsMarginTop, opacity: statsOpacity }]}>
        <Text style={styles.statLabel}>GLOBAL RANK</Text>
        <Text style={[styles.statValue, { marginTop: 8 }]}>—%</Text>
        <Text style={[styles.statLabel, { marginTop: 24 }]}>TIME</Text>
        <Text style={[styles.statValue, { marginTop: 8 }]}>{timeStr}</Text>
      </Animated.View>

      {/* CTA */}
      <Animated.View
        style={[styles.ctaWrap, { bottom: safeBottom + 20, opacity: ctaOpacity }]}
      >
        <GradientCtaButton
          label={isHistoryMode ? 'Confirm' : 'To the GRID'}
          enabled
          onPress={() => isHistoryMode ? navigation.goBack() : navigation.replace('NextRace')}
          gradientStart={ctaTheme.gradientStart}
          gradientEnd={ctaTheme.gradientEnd}
          textColor={ctaTheme.textColor}
        />
      </Animated.View>

      {/* 콘페티 — 트로피 중앙 정렬, 1초 후 fade in + 재생 */}
      <Animated.View
        style={[styles.confetti, { top: safeTop + 10, opacity: confettiOpacity }]}
        pointerEvents="none"
      >
        <LottieView
          ref={confettiRef}
          key={`confetti-${grade}`}
          source={CONFETTI_SOURCE}
          style={{ width: CONFETTI_SIZE, height: CONFETTI_SIZE }}
          autoPlay={false}
          loop={false}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  lottieWrap: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  lottie: {
    width: 462,
    height: 243,
  },
  globeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  globe: {
    width: 620,
    height: 643,
  },
  devBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 99,
  },
  devBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  devBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  devBtnText: {
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    includeFontPadding: false,
  },
  devBtnTextActive: {
    color: PALETTE.white,
  },
  bottomGradient: {
    position: 'absolute',
  },
  gradeTextWrap: {
    alignItems: 'center',
  },
  statsWrap: {
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    letterSpacing: -0.26,
    color: 'rgba(255,255,255,0.5)',
    includeFontPadding: false,
  },
  statValue: {
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    letterSpacing: 0,
    color: PALETTE.white,
    includeFontPadding: false,
  },
  ctaWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  confetti: {
    position: 'absolute',
    left: '50%',
    marginLeft: -(CONFETTI_SIZE / 2),
    width: CONFETTI_SIZE,
    height: CONFETTI_SIZE,
  },
});
