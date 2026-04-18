import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import GradientCtaButton from '../components/GradientCtaButton';
import { useAppStore } from '../store/appStore';
import { formatStopwatch, formatPace } from '../core/pace';
import type { QualifyingPostScreenProps } from '../navigation/types';
import type { QualifyingGrade } from '../types';

// ─── Grade-specific CTA colors ───────────────────────────────────────────────

type CtaTheme = { gradientStart: string; gradientEnd: string; textColor: string };

const CTA_THEME: Record<QualifyingGrade, CtaTheme> = {
  f3:          { gradientStart: '#E03A3E', gradientEnd: '#FF4D51', textColor: '#FFFFFF' },
  f2:          { gradientStart: '#FCB827', gradientEnd: '#FFBE35', textColor: '#17171C' },
  f1_rookie:   { gradientStart: '#59B345', gradientEnd: '#50C736', textColor: '#FFFFFF' },
  f1:          { gradientStart: '#8528C5', gradientEnd: '#8C29CF', textColor: '#FFFFFF' },
  f1_champion: { gradientStart: '#E03A3E', gradientEnd: '#FF4D51', textColor: '#FFFFFF' },
};

// ─── Grade-specific Lottie sources ───────────────────────────────────────────

const LOTTIE_SOURCE: Record<QualifyingGrade, object> = {
  f3:          require('../../assets/qualifying/lottie/f3.json'),
  f2:          require('../../assets/qualifying/lottie/f2.json'),
  f1_rookie:   require('../../assets/qualifying/lottie/f1-rookie.json'),
  f1:          require('../../assets/qualifying/lottie/f1.json'),
  f1_champion: require('../../assets/qualifying/lottie/f1-champion.json'),
};

// 애니메이션 총 124프레임 @ 약 29.97fps ≈ 4140ms
const ANIM_DURATION_MS = 4200;
// 텍스트/CTA 페이드인 딜레이
const TEXT_DELAY_MS = ANIM_DURATION_MS + 200;
const CTA_DELAY_MS = TEXT_DELAY_MS + 500;

export default function QualifyingPostScreen({ navigation }: QualifyingPostScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const qualifyingResult = useAppStore((s) => s.qualifyingResult);
  const grade = qualifyingResult?.grade ?? 'f3';
  const ctaTheme = CTA_THEME[grade];

  const lottieRef = useRef<LottieView>(null);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const [animDone, setAnimDone] = useState(false);

  const handleAnimationFinish = () => {
    setAnimDone(true);
    Animated.sequence([
      Animated.timing(textOpacity, {
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
    ? formatStopwatch(qualifyingResult.oneKmMs)
    : '--:--';
  const paceStr = qualifyingResult
    ? formatPace(qualifyingResult.paceSecPerKm) + '/km'
    : '--';

  return (
    <View style={styles.root}>
      {/* Lottie 트로피 애니메이션 */}
      <View style={[styles.lottieWrap, { marginTop: safeTop + 60 }]}>
        <LottieView
          ref={lottieRef}
          source={LOTTIE_SOURCE[grade]}
          style={styles.lottie}
          autoPlay
          loop={false}
          onAnimationFinish={handleAnimationFinish}
          resizeMode="contain"
        />
      </View>

      {/* 성적 텍스트 */}
      <Animated.View style={[styles.statsWrap, { opacity: textOpacity }]}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>GLOBAL RANK</Text>
          <Text style={styles.statValue}>—</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>TIME</Text>
          <Text style={styles.statValue}>{timeStr}</Text>
        </View>
      </Animated.View>

      {/* CTA */}
      <Animated.View
        style={[
          styles.ctaWrap,
          { bottom: safeBottom + 20, opacity: ctaOpacity },
        ]}
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
    paddingHorizontal: 20,
  },
  lottie: {
    width: '100%',
    aspectRatio: 462 / 243,
  },
  statsWrap: {
    marginTop: 48,
    marginHorizontal: 20,
    gap: 0,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    fontSize: 20,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  ctaWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
