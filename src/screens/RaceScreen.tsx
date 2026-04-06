/**
 * RaceScreen — 두 번째 탭 (Play) 화면
 * Practice / Qualifying / Grand Prix 세 가지 모드 선택
 */

import React, { useCallback, useMemo, useRef } from 'react';
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
  Path,
  Rect,
} from 'react-native-svg';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import type { RaceScreenProps } from '../navigation/types';

// ─── Assets ──────────────────────────────────────────────────────────────────

const STOPWATCH_ICON = require('../../assets/icons/qualifying-warmup-5ce716.png');
const TROPHY_ICON = require('../../assets/race-trophy.png');
const FLAG_ICON = require('../../assets/race-flag.png');

// ─── Tab icon SVG paths (공유) ────────────────────────────────────────────────

const HOME_P1 =
  'M4 15.9877V19.335C4 23.7347 4 25.9346 5.36683 27.3015C6.73367 28.6683 8.93356 28.6683 13.3333 28.6683H18.6667C23.0664 28.6683 25.2663 28.6683 26.6332 27.3015C28 25.9346 28 23.7347 28 19.335V15.9877C28 13.7461 28 12.6253 27.5255 11.655C27.0509 10.6848 26.1662 9.99667 24.3968 8.62043L21.7301 6.54636C18.9775 4.40543 17.6012 3.33496 16 3.33496C14.3988 3.33496 13.0225 4.40543 10.2699 6.54636L7.60322 8.62044C5.83378 9.99667 4.94906 10.6848 4.47453 11.655C4 12.6253 4 13.7461 4 15.9877Z';
const HOME_P2 =
  'M20 28.6676V22.001C20 20.1154 20 19.1725 19.4142 18.5868C18.8284 18.001 17.8856 18.001 16 18.001C14.1144 18.001 13.1716 18.001 12.5858 18.5868C12 19.1725 12 20.1154 12 22.001V28.6676';
const PLAY_P =
  'M28.489 17.3536C27.9168 19.5024 25.2122 21.0208 19.8031 24.0577C14.5741 26.9935 11.9596 28.4614 9.85259 27.8713C8.98149 27.6274 8.18782 27.1641 7.54773 26.5259C5.99953 24.9822 5.99953 21.9882 5.99953 16C5.99953 10.0118 5.99953 7.01776 7.54773 5.47411C8.18782 4.83591 8.98149 4.37262 9.85259 4.12867C11.9596 3.53864 14.5741 5.00652 19.8031 7.94228C25.2122 10.9792 27.9168 12.4976 28.489 14.6464C28.7252 15.5334 28.7252 16.4666 28.489 17.3536Z';
const TASK_P1 =
  'M19.3333 2.66504H12.6667C11.5621 2.66504 10.6667 3.56047 10.6667 4.66504C10.6667 5.76961 11.5621 6.66504 12.6667 6.66504H19.3333C20.4379 6.66504 21.3333 5.76961 21.3333 4.66504C21.3333 3.56047 20.4379 2.66504 19.3333 2.66504Z';
const TASK_P2 = 'M10.6667 19.9984H15.2381M10.6667 14.665H21.3333';
const TASK_P3 =
  'M21.3329 4.66504C23.4041 4.72745 24.6396 4.95847 25.4947 5.81353C26.6662 6.98509 26.6662 8.87069 26.6662 12.6419L26.6662 21.331C26.6662 25.1022 26.6662 26.9878 25.4946 28.1594C24.3231 29.331 22.4374 29.331 18.6662 29.331L13.3329 29.331C9.56164 29.331 7.67603 29.331 6.50446 28.1594C5.33288 26.9879 5.33288 25.1023 5.33287 21.331L5.33289 12.642C5.33288 8.87071 5.33288 6.98509 6.50445 5.81351C7.3595 4.95846 8.59489 4.72745 10.6661 4.66504';
const USER_P1 =
  'M22.1942 9.96707C22.1942 6.67478 19.5253 4.00586 16.233 4.00586C12.9407 4.00586 10.2718 6.67478 10.2718 9.96707C10.2718 13.2594 12.9407 15.9283 16.233 15.9283C19.5253 15.9283 22.1942 13.2594 22.1942 9.96707Z';
const USER_P2 =
  'M16.2337 15.9277C20.8402 15.9277 24.7494 19.0025 26.1316 23.2679C26.7914 25.3041 25.5482 27.4024 23.5367 28.1342C18.0726 30.122 12.643 29.33 8.95714 28.0687C6.93196 27.3756 5.67601 25.3041 6.33586 23.2679C7.71806 19.0025 11.6272 15.9277 16.2337 15.9277Z';

// ─── 카드 내 화살표 (Vector 1 (1).svg: 10×16, 오른쪽 방향 > ) ────────────────

const ARROW_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const FIGMA_STATUS    = 59;
const FIGMA_TAB_H     = 98;
const FIGMA_SAFE_BOTTOM = 34;

// ─── RaceScreen ──────────────────────────────────────────────────────────────

export default function RaceScreen({ navigation }: RaceScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop    = useSafeTop();
  const safeBottom = useSafeBottom();

  const py = (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS);

  // 카드: 좌우 28px 마진, fill
  const cardW    = windowW - 56;
  const cardLeft = 28;

  // 탭바 레이아웃 (HomeScreen과 동일 로직)
  const tabH      = FIGMA_TAB_H - FIGMA_SAFE_BOTTOM + safeBottom;
  const tabZoneW  = windowW / 4;
  const homeLeft  = Math.round(tabZoneW * 0 + (tabZoneW - 32) / 2);
  const playLeft  = Math.round(tabZoneW * 1 + (tabZoneW - 32) / 2);
  const taskLeft  = Math.round(tabZoneW * 2 + (tabZoneW - 32) / 2);
  const userLeft  = Math.round(tabZoneW * 3 + (tabZoneW - 32) / 2);

  // Play 탭 활성: 인디케이터 바·사다리꼴 그라데이션
  const activeBarLeft = playLeft + 16 - 32;
  const glowW    = Math.round(tabZoneW);
  const glowHalf = Math.max(0, (glowW - 64) / 2);
  const glowLeft = Math.round(tabZoneW * 1); // play zone 시작 x

  const glowSlices = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const xl1 = glowHalf * (8 - i) / 8;
    const xr1 = glowW - xl1;
    const xl2 = glowHalf * (7 - i) / 8;
    const xr2 = glowW - xl2;
    const y1 = i * tabH / 8;
    const y2 = (i + 1) * tabH / 8;
    const op = ((7 - i) / 7 * 0.2).toFixed(3);
    return <Path key={i} d={`M${xl1} ${y1}H${xr1}L${xr2} ${y2}H${xl2}Z`} fill={`rgba(224,58,62,${op})`} />;
  }), [glowW, glowHalf, tabH]);

  // 탭바 바 애니메이션
  const barAnim = useRef(new Animated.Value(0)).current;
  const barTranslateX = useMemo(
    () => barAnim.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFocusEffect(
    useCallback(() => {
      barAnim.setValue(0);
      Animated.spring(barAnim,
        { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 },
      ).start();
    }, [barAnim]),
  );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#17171C' }]}>

      {/* ── "Race" 타이틀 ── */}
      <Text style={[s.title, { left: cardLeft, top: py(86) }]}>Race</Text>

      {/* ── Practice 카드 ── */}
      <Pressable
        style={[s.card, { left: cardLeft, top: py(153), width: cardW, height: 138 }]}
        onPress={() => navigation.navigate('Setup')}
      >
        <Image
          source={STOPWATCH_ICON}
          style={{ position: 'absolute', left: 20, top: 20, width: 29, height: 33 }}
          resizeMode="contain"
        />
        <Text style={[s.cardTitle, { top: 63 }]}>Practice</Text>
        <Text style={[s.cardSub,   { top: 98 }]}>Free run, pace not tracked</Text>
        <View style={s.arrowWrap}>
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d={ARROW_PATH} stroke="white" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
          </Svg>
        </View>
      </Pressable>

      {/* ── Qualifying 카드 ── */}
      <Pressable
        style={[s.card, { left: cardLeft, top: py(304), width: cardW, height: 137 }]}
        onPress={() => navigation.navigate('Qualifying')}
      >
        <Image
          source={TROPHY_ICON}
          style={{ position: 'absolute', left: 20, top: 20, width: 31, height: 32 }}
          resizeMode="contain"
        />
        <Text style={[s.cardTitle, { top: 62 }]}>Qualifying</Text>
        <Text style={[s.cardSub,   { top: 97 }]}>1km test to earn your license</Text>
        <View style={s.arrowWrap}>
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d={ARROW_PATH} stroke="white" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
          </Svg>
        </View>
      </Pressable>

      {/* ── Grand Prix 카드 ── */}
      <Pressable
        style={[s.card, { left: cardLeft, top: py(455), width: cardW, height: 141 }]}
        onPress={() => navigation.navigate('Setup')}
      >
        <Image
          source={FLAG_ICON}
          style={{ position: 'absolute', left: 20, top: 20, width: 36, height: 36 }}
          resizeMode="contain"
        />
        <Text style={[s.cardTitle, { top: 66 }]}>Grand Prix</Text>
        <Text style={[s.cardSub,   { top: 101 }]}>Interval on a real circuit</Text>
        <View style={s.arrowWrap}>
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d={ARROW_PATH} stroke="white" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
          </Svg>
        </View>
      </Pressable>

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

      {/* ── 탭바 ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: tabH,
          backgroundColor: '#202028',
        }}
      >
        {/* Play zone 사다리꼴 글로우 — 위→아래 그라데이션, Defs/id 미사용 */}
        <Animated.View
          style={{
            position: 'absolute', left: glowLeft, top: 0,
            width: glowW, height: tabH,
            opacity: barAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          }}
          pointerEvents="none"
        >
          <Svg width={glowW} height={tabH} viewBox={`0 0 ${glowW} ${tabH}`}>
            {glowSlices}
          </Svg>
        </Animated.View>

        {/* Play 탭 활성 인디케이터 바 — 왼쪽에서 오른쪽으로 grow */}
        <Animated.View
          style={{
            position: 'absolute',
            left: activeBarLeft,
            top: 0,
            width: 64,
            height: 2,
            backgroundColor: '#E03A3E',
            transform: [{ translateX: barTranslateX }, { scaleX: barAnim }],
          }}
        />

        {/* home (비활성 → 흰색) */}
        <Pressable
          style={{ position: 'absolute', left: homeLeft, top: 20 }}
          onPress={() => navigation.navigate('Home')}
        >
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={HOME_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={HOME_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        {/* play (활성 → 빨간색) */}
        <View style={{ position: 'absolute', left: playLeft, top: 20 }}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={PLAY_P} stroke="#E03A3E" strokeWidth={2.25} strokeLinejoin="round" />
          </Svg>
        </View>

        {/* task */}
        <Pressable
          style={{ position: 'absolute', left: taskLeft, top: 20 }}
          onPress={() => navigation.navigate('History')}
        >
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={TASK_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={TASK_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={TASK_P3} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        {/* user */}
        <Pressable
          style={{ position: 'absolute', left: userLeft, top: 20 }}
          onPress={() => navigation.navigate('Profile')}
        >
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={USER_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={USER_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>
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
  card: {
    position: 'absolute',
    backgroundColor: '#202028',
    borderRadius: 12,
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
  // 카드 오른쪽 끝에서 24px, 세로 중앙 정렬
  arrowWrap: {
    position: 'absolute',
    right: 24,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
