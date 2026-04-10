import React, { useCallback, useId, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import Svg, { Defs, LinearGradient as SvgLG, Path, Rect, Stop } from 'react-native-svg';
import { useSafeBottom } from '../hooks/useSafeBottom';
import type { RootStackParamList } from '../navigation/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TAB_BAR_H = 78;
export const TAB_BAR_SIDE = 20;
const TAB_BAR_BOTTOM_GAP = 8;

export function useTabBarTotalHeight(): number {
  const safeBottom = useSafeBottom();
  return TAB_BAR_H + TAB_BAR_BOTTOM_GAP + safeBottom;
}

// ─── Icon paths ───────────────────────────────────────────────────────────────

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

// ─── Animated SVG Path ────────────────────────────────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { activeTab: 0 | 1 | 2 | 3 };

export default function TabBar({ activeTab }: Props) {
  const { width: windowW } = useWindowDimensions();
  const safeBottom = useSafeBottom();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const gradId = useId();

  const tabBarW = windowW - TAB_BAR_SIDE * 2;
  const tabBarBottom = safeBottom + TAB_BAR_BOTTOM_GAP;
  const iconTop = Math.round((TAB_BAR_H - 32) / 2);
  const iconLefts = [0, 1, 2, 3].map(i => Math.round(16 + (tabBarW - 32) / 4 * i + (tabBarW - 32) / 8 - 16));
  const iconCenters = iconLefts.map(x => x + 16);

  const pillX = useRef(new Animated.Value(iconCenters[activeTab])).current;
  const scaleXAnim = useRef(new Animated.Value(1)).current;
  const scaleYAnim = useRef(new Animated.Value(1)).current;
  const iconColorAnims = useRef([0, 1, 2, 3].map(i => new Animated.Value(i === activeTab ? 1 : 0))).current;

  const navigateTo = useCallback((tab: number) => {
    // 출발: stretch → 바로 복귀 (pillX 이동과 독립)
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleXAnim, { toValue: 1.3, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleYAnim, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scaleXAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleYAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]),
    ]).start();

    // 색상 전환: pill 도착과 동시
    Animated.timing(iconColorAnims[activeTab], { toValue: 0, duration: 150, delay: 200, useNativeDriver: false }).start();
    Animated.timing(iconColorAnims[tab], { toValue: 1, duration: 150, delay: 200, useNativeDriver: false }).start();

    // 이동
    Animated.timing(pillX, {
      toValue: iconCenters[tab],
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // 도착: squash → spring 복귀
      Animated.parallel([
        Animated.timing(scaleXAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleYAnim, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      ]).start(() => {
        Animated.parallel([
          Animated.spring(scaleXAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 180 }),
          Animated.spring(scaleYAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 180 }),
        ]).start();
      });
    });

    if (tab === 0) navigation.navigate('Home');
    else if (tab === 1) navigation.navigate('Race');
    else if (tab === 2) navigation.navigate('History');
    else navigation.navigate('Profile');
  }, [scaleXAnim, scaleYAnim, pillX, iconCenters, iconColorAnims, activeTab, navigation]);

  const strokeColors = iconColorAnims.map(anim =>
    anim.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#E03A3E'] }),
  );
  const [hL, pL, tL, uL] = iconLefts;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: tabBarBottom,
        left: TAB_BAR_SIDE,
        width: tabBarW,
        height: TAB_BAR_H,
        borderRadius: TAB_BAR_H / 2,
        overflow: 'hidden',
      }}
    >
      {/* 글래스: 블러 + rgba 오버레이 */}
      <BlurView
        intensity={50}
        tint="dark"
        style={[StyleSheet.absoluteFillObject, { borderRadius: TAB_BAR_H / 2, overflow: 'hidden' }]}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(23,23,28,0.55)' }]} />
      </BlurView>

      {/* 글래스 테두리 */}
      <Svg width={tabBarW} height={TAB_BAR_H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLG id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={tabBarW} y2={TAB_BAR_H}>
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <Stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.03" />
            <Stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.03" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
          </SvgLG>
        </Defs>
        <Rect x={0.5} y={0.5} width={tabBarW - 1} height={TAB_BAR_H - 1} rx={TAB_BAR_H / 2 - 0.5} ry={TAB_BAR_H / 2 - 0.5} fill="none" stroke={`url(#${gradId})`} strokeWidth={1} />
      </Svg>

      {/* pill */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: (TAB_BAR_H - 58) / 2,
          width: 76,
          height: 58,
          borderRadius: 29,
          backgroundColor: 'rgba(224,58,62,0.15)',
          transform: [{ translateX: Animated.subtract(pillX, 38) }, { scaleX: scaleXAnim }, { scaleY: scaleYAnim }],
        }}
      />

      {/* home */}
      <Pressable style={{ position: 'absolute', left: hL, top: iconTop }} onPress={() => navigateTo(0)}>
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <AnimatedPath d={HOME_P1} stroke={strokeColors[0]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath d={HOME_P2} stroke={strokeColors[0]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      {/* play */}
      <Pressable style={{ position: 'absolute', left: pL, top: iconTop }} onPress={() => navigateTo(1)}>
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <AnimatedPath d={PLAY_P} stroke={strokeColors[1]} strokeWidth={2.25} strokeLinejoin="round" />
        </Svg>
      </Pressable>

      {/* task */}
      <Pressable style={{ position: 'absolute', left: tL, top: iconTop }} onPress={() => navigateTo(2)}>
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <AnimatedPath d={TASK_P1} stroke={strokeColors[2]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath d={TASK_P2} stroke={strokeColors[2]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath d={TASK_P3} stroke={strokeColors[2]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      {/* user */}
      <Pressable style={{ position: 'absolute', left: uL, top: iconTop }} onPress={() => navigateTo(3)}>
        <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
          <AnimatedPath d={USER_P1} stroke={strokeColors[3]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath d={USER_P2} stroke={strokeColors[3]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>
  );
}
