import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import GradientCtaButton from '../components/GradientCtaButton';
import { useAppStore } from '../store/appStore';
import { formatPace } from '../core/pace';
import type { QualifyingPostScreenProps } from '../navigation/types';
import type { QualifyingGrade } from '../types';

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
  f3:          { source: require('../../assets/qualifying/text/f3.png'),          width: 157, height: 86,  gradeTextMarginTop: -20, statsMarginTop: 28 },
  f2:          { source: require('../../assets/qualifying/text/f2.png'),          width: 165, height: 86,  gradeTextMarginTop: -20, statsMarginTop:  4 },
  f1:          { source: require('../../assets/qualifying/text/f1.png'),          width: 156, height: 86,  gradeTextMarginTop: -20, statsMarginTop:  0 },
  f1_rookie:   { source: require('../../assets/qualifying/text/f1-rookie.png'),   width: 138, height: 116, gradeTextMarginTop:  -2, statsMarginTop: 22 },
  f1_champion: { source: require('../../assets/qualifying/text/f1-champion.png'), width: 207, height: 116, gradeTextMarginTop:  -2, statsMarginTop: 23 },
};

// ─── Grade-specific CTA colors ───────────────────────────────────────────────

type CtaTheme = { gradientStart: string; gradientEnd: string; textColor: string };

const CTA_THEME: Record<QualifyingGrade, CtaTheme> = {
  f3:          { gradientStart: '#E03A3E', gradientEnd: '#FF4D51', textColor: '#FFFFFF' },
  f2:          { gradientStart: '#FCB827', gradientEnd: '#FFBE35', textColor: '#17171C' },
  f1_rookie:   { gradientStart: '#59B345', gradientEnd: '#50C736', textColor: '#FFFFFF' },
  f1:          { gradientStart: '#8528C5', gradientEnd: '#8C29CF', textColor: '#FFFFFF' },
  f1_champion: { gradientStart: '#E03A3E', gradientEnd: '#FF4D51', textColor: '#FFFFFF' },
};

const GLOBE = require('../../assets/qualifying/globe.png');

// ─── Grade-specific Lottie sources ───────────────────────────────────────────

const LOTTIE_SOURCE: Record<QualifyingGrade, object> = {
  f3:          require('../../assets/qualifying/lottie/f3.json'),
  f2:          require('../../assets/qualifying/lottie/f2.json'),
  f1_rookie:   require('../../assets/qualifying/lottie/f1-rookie.json'),
  f1:          require('../../assets/qualifying/lottie/f1.json'),
  f1_champion: require('../../assets/qualifying/lottie/f1-champion.json'),
};

export default function QualifyingPostScreen({ navigation }: QualifyingPostScreenProps) {
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const qualifyingResult = useAppStore((s) => s.qualifyingResult);
  const grade = qualifyingResult?.grade ?? 'f3';
  const ctaTheme = CTA_THEME[grade];
  const gradeImg = GRADE_TEXT_IMAGES[grade];

  const gradeTextOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  // 글로우 효과(사다리꼴)가 프레임 0에서 시작 → 애니메이션 시작과 동시에 fade in
  useEffect(() => {
    Animated.timing(gradeTextOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAnimationFinish = () => {
    Animated.sequence([
      Animated.timing(statsOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 350,
        delay: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const timeStr = qualifyingResult
    ? formatPace(qualifyingResult.paceSecPerKm)
    : `—'——"`;

  return (
    <View style={styles.root}>
      {/* Lottie 트로피 애니메이션 */}
      <View style={[styles.lottieWrap, { marginTop: safeTop + 60 }]}>
        <LottieView
          source={LOTTIE_SOURCE[grade]}
          style={styles.lottie}
          autoPlay
          loop={false}
          onAnimationFinish={handleAnimationFinish}
          resizeMode="contain"
        />
      </View>

      {/* Globe 배경 — center trophy bottom(safeTop+60+195) + 12 */}
      <View
        style={[styles.globeWrap, { top: safeTop + 267 }]}
        pointerEvents="none"
      >
        <Image source={GLOBE} style={styles.globe} resizeMode="contain" />
      </View>

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
          label="To the GRID"
          enabled
          onPress={() => navigation.replace('NextRace')}
          gradientStart={ctaTheme.gradientStart}
          gradientEnd={ctaTheme.gradientEnd}
          textColor={ctaTheme.textColor}
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
    width: 533,
    height: 564,
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
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  ctaWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
