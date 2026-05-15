/**
 * RaceScreen — 두 번째 탭 (Play) 화면
 * Practice / Qualifying / Grand Prix 세 가지 모드 선택
 */

import { COLORS, PALETTE } from '../constants/colors';
import { radius } from '../constants/radius';
import React, { useCallback, useId, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Rect } from 'react-native-svg';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import GradientCardBorder from '../components/GradientCardBorder';
import { useTabBarTotalHeight } from '../components/TabBar';
import type { RaceScreenProps } from '../navigation/types';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useAuthStore } from '../store/authStore';
import { logModeSelected } from '../lib/analytics/raceEvents';

// ─── Assets ──────────────────────────────────────────────────────────────────

const STOPWATCH_ICON = require('../../assets/icons/qualifying-warmup-5ce716.png');
const TROPHY_ICON = require('../../assets/race-trophy.png');
const FLAG_ICON = require('../../assets/race-flag.png');

// ─── 상수 ────────────────────────────────────────────────────────────────────

const FIGMA_STATUS = 23;

// ─── RaceScreen ──────────────────────────────────────────────────────────────

export default function RaceScreen({ navigation }: RaceScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop    = useSafeTop();
  const safeBottom = useSafeBottom();
  const { ensurePermission } = useLocationPermission();
  const { user } = useAuthStore();

  const py = (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS);

  // 카드: 좌우 28px 마진, fill
  const cardW    = windowW - 40;
  const cardLeft = 20;

  const tabH = useTabBarTotalHeight();

  // 인스턴스 고유 ID (여러 RaceScreen 인스턴스의 gradient ID 충돌 방지)
  const rawId = useId();
  const idBase = rawId.replace(/[^a-zA-Z0-9]/g, '_');

  // SVG gradient key — 포커스 시마다 증가해 웹에서 url() 참조를 강제 재등록
  const [svgKey, setSvgKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setSvgKey(k => k + 1);
    }, []),
  );

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

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>

      {/* ── "Race" 타이틀 ── */}
      <Text style={[styles.title, { left: 24, top: py(86) }]}>Race</Text>

      {/* ── Practice 카드 ── */}
      <GradientCardBorder
        style={{ position: 'absolute', left: cardLeft, top: py(153), width: cardW, height: 138 }}
        borderRadius={radius.sm.borderRadius}
        onPress={async () => {
          const granted = await ensurePermission();
          if (!granted) return;
          if (user?.id) logModeSelected({ userId: user.id, mode: 'practice' }).catch(() => {});
          navigation.navigate('Practice');
        }}
      >
        <Image
          source={STOPWATCH_ICON}
          style={{ position: 'absolute', left: 24, top: 20, width: 29, height: 33 }}
          resizeMode="contain"
        />
        <Text style={[styles.cardTitle, { top: 63 }]}>Practice</Text>
        <Text style={[styles.cardSub,   { top: 98 }]}>Free run, pace not tracked</Text>
      </GradientCardBorder>

      {/* ── Qualifying 카드 ── */}
      <GradientCardBorder
        style={{ position: 'absolute', left: cardLeft, top: py(303), width: cardW, height: 137 }}
        borderRadius={radius.sm.borderRadius}
        onPress={() => {
          if (user?.id) logModeSelected({ userId: user.id, mode: 'qualifying' }).catch(() => {});
          navigation.navigate('Qualifying');
        }}
      >
        <Image
          source={TROPHY_ICON}
          style={{ position: 'absolute', left: 24, top: 20, width: 31, height: 32 }}
          resizeMode="contain"
        />
        <Text style={[styles.cardTitle, { top: 62 }]}>Qualifying</Text>
        <Text style={[styles.cardSub,   { top: 97 }]}>1km test to earn your license</Text>
      </GradientCardBorder>

      {/* ── Grand Prix 카드 ── */}
      <GradientCardBorder
        style={{ position: 'absolute', left: cardLeft, top: py(452), width: cardW, height: 141 }}
        borderRadius={radius.sm.borderRadius}
        onPress={() => {
          if (user?.id) logModeSelected({ userId: user.id, mode: 'grand_prix' }).catch(() => {});
          navigation.navigate('Setup');
        }}
      >
        <Image
          source={FLAG_ICON}
          style={{ position: 'absolute', left: 24, top: 20, width: 36, height: 36 }}
          resizeMode="contain"
        />
        <Text style={[styles.cardTitle, { top: 66 }]}>Grand Prix</Text>
        <Text style={[styles.cardSub,   { top: 101 }]}>Interval on a real circuit</Text>
      </GradientCardBorder>

      {/* ── 그라데이션 페이드 — Defs 없이 Rect 단계별 렌더 ── */}
      <Svg
        width={windowW}
        height={48}
        style={{ position: 'absolute', bottom: tabH, left: 0 }}
        pointerEvents="none"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Rect
            key={i}
            x={0} y={i * 6} width={windowW} height={6}
            fill={COLORS.bg}
            fillOpacity={i / 7}
          />
        ))}
      </Svg>


    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  title: {
    position: 'absolute',
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    lineHeight: 43,
    letterSpacing: 36 * 0.05,
    color: PALETTE.white,
    includeFontPadding: false,
  },
  cardTitle: {
    position: 'absolute',
    left: 24,
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    color: PALETTE.white,
    includeFontPadding: false,
  },
  cardSub: {
    position: 'absolute',
    left: 24,
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 17 * -0.02,
    color: PALETTE.white,
    opacity: 0.5,
    includeFontPadding: false,
  },
});
