/**
 * RaceScreen — 두 번째 탭 (Play) 화면
 * Practice / Qualifying / Grand Prix 세 가지 모드 선택
 */

import React, { useCallback, useId, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import { CARD_FILL } from '../components/GradientCardBorder';
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

const FIGMA_STATUS = 59;

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

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#17171C' }]}>

      {/* ── "Race" 타이틀 ── */}
      <Text style={[s.title, { left: 24, top: py(83) }]}>Race</Text>

      {/* ── Practice 카드 ── */}
      <View style={{ position: 'absolute', left: cardLeft, top: py(153), width: cardW, height: 138, borderRadius: 16 }}>
        <Svg key={svgKey} width={cardW} height={138} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgLinearGradient id={`rbg1_${idBase}_${svgKey}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardW} y2={138}>
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0.25} y={0.25} width={cardW - 0.5} height={137.5} rx={15.75} ry={15.75} fill="none" stroke={`url(#rbg1_${idBase}_${svgKey})`} strokeWidth={0.5} />
        </Svg>
        <Pressable
          style={[s.cardInner, { flex: 1, margin: 0.5 }]}
          onPress={async () => {
            const granted = await ensurePermission();
            if (!granted) return;
            if (user?.id) logModeSelected({ userId: user.id, mode: 'practice' }).catch(() => {});
            navigation.navigate('Practice');
          }}
        >
          <Image
            source={STOPWATCH_ICON}
            style={{ position: 'absolute', left: 20, top: 20, width: 29, height: 33 }}
            resizeMode="contain"
          />
          <Text style={[s.cardTitle, { top: 63 }]}>Practice</Text>
          <Text style={[s.cardSub,   { top: 98 }]}>Free run, pace not tracked</Text>
        </Pressable>
      </View>

      {/* ── Qualifying 카드 ── */}
      <View style={{ position: 'absolute', left: cardLeft, top: py(303), width: cardW, height: 137, borderRadius: 16 }}>
        <Svg key={svgKey} width={cardW} height={137} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgLinearGradient id={`rbg2_${idBase}_${svgKey}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardW} y2={137}>
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0.25} y={0.25} width={cardW - 0.5} height={136.5} rx={15.75} ry={15.75} fill="none" stroke={`url(#rbg2_${idBase}_${svgKey})`} strokeWidth={0.5} />
        </Svg>
        <Pressable
          style={[s.cardInner, { flex: 1, margin: 0.5 }]}
          onPress={() => {
            if (user?.id) logModeSelected({ userId: user.id, mode: 'qualifying' }).catch(() => {});
            navigation.navigate('Qualifying');
          }}
        >
          <Image
            source={TROPHY_ICON}
            style={{ position: 'absolute', left: 20, top: 20, width: 31, height: 32 }}
            resizeMode="contain"
          />
          <Text style={[s.cardTitle, { top: 62 }]}>Qualifying</Text>
          <Text style={[s.cardSub,   { top: 97 }]}>1km test to earn your license</Text>
        </Pressable>
      </View>

      {/* ── Grand Prix 카드 ── */}
      <View style={{ position: 'absolute', left: cardLeft, top: py(452), width: cardW, height: 141, borderRadius: 16 }}>
        <Svg key={svgKey} width={cardW} height={141} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgLinearGradient id={`rbg3_${idBase}_${svgKey}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardW} y2={141}>
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0.25} y={0.25} width={cardW - 0.5} height={140.5} rx={15.75} ry={15.75} fill="none" stroke={`url(#rbg3_${idBase}_${svgKey})`} strokeWidth={0.5} />
        </Svg>
        <Pressable
          style={[s.cardInner, { flex: 1, margin: 0.5 }]}
          onPress={() => {
            if (user?.id) logModeSelected({ userId: user.id, mode: 'grand_prix' }).catch(() => {});
            navigation.navigate('Setup');
          }}
        >
          <Image
            source={FLAG_ICON}
            style={{ position: 'absolute', left: 20, top: 20, width: 36, height: 36 }}
            resizeMode="contain"
          />
          <Text style={[s.cardTitle, { top: 66 }]}>Grand Prix</Text>
          <Text style={[s.cardSub,   { top: 101 }]}>Interval on a real circuit</Text>
        </Pressable>
      </View>

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
            fill="#17171C"
            fillOpacity={i / 7}
          />
        ))}
      </Svg>


    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  title: {
    position: 'absolute',
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    lineHeight: 43,
    letterSpacing: 36 * 0.05,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  cardInner: {
    borderRadius: 15.5,
    backgroundColor: CARD_FILL,
    overflow: 'hidden',
  },
  cardTitle: {
    position: 'absolute',
    left: 20,
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  cardSub: {
    position: 'absolute',
    left: 20,
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 17 * -0.02,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
});
