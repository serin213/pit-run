import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLG,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import { useAppStore } from '../store/appStore';
import { useTabBarTotalHeight } from '../components/TabBar';
import type { ProfileScreenProps } from '../navigation/types';

// ─── Card SVG path generator ──────────────────────────────────────────────────
// Rule: left side (x ≤ 134.427) is fixed; right-side x-coords shift by (cardW - 338).
// Height is always fixed at 393 viewBox units (389px visual). Only horizontal stretch.

function makeCardPath(cardW: number): string {
  const dx = cardW - 338;
  const rx = (x: number) => (x + dx).toFixed(3);
  return (
    `M86.4782 31.3353H22C10.9543 31.3353 2 40.2896 2 51.3353V371` +
    `C2 382.046 10.9543 391 22 391H${rx(252.645)}` +
    `C${rx(257.083)} 391 ${rx(261.395)} 389.524 ${rx(264.902)} 386.804` +
    `L${rx(332.257)} 334.565` +
    `C${rx(337.142)} 330.777 ${rx(340)} 324.943 ${rx(340)} 318.761V40.2439` +
    `C${rx(340)} 34.5734 ${rx(337.593)} 29.1694 ${rx(333.378)} 25.3765` +
    `L${rx(313.102)} 7.13257` +
    `C${rx(309.43)} 3.82828 ${rx(304.664)} 2 ${rx(299.724)} 2H134.427` +
    `C129.487 2 124.722 3.82828 121.05 7.13257L99.8558 26.2027` +
    `C96.1835 29.507 91.4182 31.3353 86.4782 31.3353Z`
  );
}

const ARROW_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

// ─── Grade badge images ───────────────────────────────────────────────────────

const GRADE_BADGES: Record<string, ReturnType<typeof require>> = {
  f1_champion: require('../../assets/grade-f1-rainbow.png'),
  f1: require('../../assets/grade-f1-purple.png'),
  f1_rookie: require('../../assets/grade-f1-green.png'),
  f2: require('../../assets/grade-f2.png'),
  f3: require('../../assets/grade-unranked.png'),
  none: require('../../assets/grade-unranked.png'),
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FIGMA_STATUS = 59;
const APP_VERSION: string = (
  require('../../app.json') as { expo: { version: string } }
).expo.version;

// ─── AnimatedToggle ───────────────────────────────────────────────────────────
// OFF state: white circle (r=8, diameter 16) centered in gray pill
// ON state:  red circle (r=12, diameter 24) fills the slot on the right

function AnimatedToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: on ? 1 : 0,
      useNativeDriver: false,
      friction: 10,   // higher = less bounce
      tension: 100,
    }).start();
  }, [on, anim]);

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.1)', 'rgba(224,58,62,0.3)'],
  });

  // Circle x: slides from left (center at 12) to right (center at 36)
  const circleX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 24],
  });

  const circleColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,1)', 'rgba(224,58,62,1)'],
  });

  // Diameter: 16 (OFF) → 24 (ON)
  const circleSize = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 24],
  });

  // Vertical centering: top offset = (24 - circleSize) / 2
  // OFF: (24-16)/2 = 4, ON: (24-24)/2 = 0
  const circleTop = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 0],
  });

  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Animated.View
        style={{
          width: 48,
          height: 24,
          borderRadius: 12,
          backgroundColor: bgColor,
          overflow: 'hidden',
        }}
      >
        {/* Sliding circle — translated within the pill */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 24,
            height: 24,
            transform: [{ translateX: circleX }],
          }}
        >
          {/* Circle centered vertically within the 24×24 slot */}
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: circleTop,
              width: circleSize,
              alignSelf: 'center',
              height: circleSize,
              borderRadius: 12,
              backgroundColor: circleColor,
            }}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const profile                = useAppStore((s) => s.profile);
  const qualifyingResult       = useAppStore((s) => s.qualifyingResult);
  const activityDates          = useAppStore((s) => s.activityDates);
  const totalDistanceKm        = useAppStore((s) => s.totalDistanceKm);
  const notificationsEnabled   = useAppStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled);

  const py = (figmaY: number) => safeTop + (figmaY - FIGMA_STATUS);

  // ─── Card dimensions ──────────────────────────────────────────────────────
  // Height is ALWAYS fixed (393px viewBox / 389px visual). Only width stretches.
  const cardW = windowW - 40;
  const cardSvgW = cardW + 4; // +4 for 2px stroke bleed per side
  const CARD_SVG_H = 393;     // fixed viewBox height
  const cardTop = py(108);
  const cardPath = makeCardPath(cardW);

  // ─── Grade badge ──────────────────────────────────────────────────────────
  const gradeBadge = useMemo(() => {
    if (!qualifyingResult) return GRADE_BADGES.none;
    return GRADE_BADGES[qualifyingResult.grade] ?? GRADE_BADGES.none;
  }, [qualifyingResult]);

  // Compute badge width from native image dimensions so it left-aligns correctly.
  // resizeMode: 'contain' centers the image in the container; we make the container
  // exactly match the image's natural aspect ratio at height=29 to avoid centering gap.
  const badgeW = useMemo(() => {
    try {
      const src = Image.resolveAssetSource(gradeBadge);
      return Math.round(29 * src.width / src.height);
    } catch {
      return 57;
    }
  }, [gradeBadge]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const distanceStr = totalDistanceKm > 0
    ? `${totalDistanceKm.toFixed(2)}km`
    : '--';
  const daysStr = `${activityDates.length} days`;
  const bestQualStr = useMemo(() => {
    if (!qualifyingResult) return '--';
    const totalS = Math.round(qualifyingResult.paceSecPerKm);
    const mins = Math.floor(totalS / 60);
    const secs = totalS % 60;
    return `${mins}'${String(secs).padStart(2, '0')}"`;
  }, [qualifyingResult]);

  const tabH = useTabBarTotalHeight();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#17171C' }]}>

      {/* ── Driver Card ── */}
      <View
        style={{
          position: 'absolute',
          left: 18,
          top: cardTop - 2,
          width: cardSvgW,
          height: CARD_SVG_H,
        }}
      >
        {/* Card shape SVG — width stretches, height is always 393 */}
        <Svg
          width={cardSvgW}
          height={CARD_SVG_H}
          viewBox={`0 0 ${cardSvgW} 393`}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgLG id="profileCardBorderGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={cardSvgW} y2={CARD_SVG_H}>
              <Stop offset="0%" stopColor={profile.nameTagAccentColor} stopOpacity="1" />
              <Stop offset="25%" stopColor={profile.nameTagAccentColor} stopOpacity="0.2" />
              <Stop offset="75%" stopColor={profile.nameTagAccentColor} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={profile.nameTagAccentColor} stopOpacity="0.5" />
            </SvgLG>
          </Defs>
          <Path
            d={cardPath}
            fill="#202028"
            fillOpacity={0.4}
            stroke="url(#profileCardBorderGrad)"
            strokeWidth={1}
          />
        </Svg>

        {/* Card content (2px inset = visual card boundary) */}
        <View style={{ position: 'absolute', left: 2, top: 2, right: 2, bottom: 2, overflow: 'hidden' }}>

          {/* Grade badge — 61px from card top, 24px from card left.
              Width is computed from native image dimensions so the image fills its
              container exactly and the left edge aligns with other texts at x=24. */}
          <Image
            source={gradeBadge}
            style={{ position: 'absolute', left: 26, top: 61, height: 29, width: badgeW }}
            resizeMode="contain"
          />

          {/* Name (tappable) — 24px from card left */}
          <Pressable
            style={{ position: 'absolute', left: 24, top: 95 }}
            onPress={() => navigation.navigate('ProfileEdit')}
          >
            <Text style={s.name} numberOfLines={1}>{profile.displayName}</Text>
          </Pressable>

          {/* Stats — all 24px from card left */}
          <Text style={[s.statLabel, { left: 24, top: 173 }]}>TOTAL DISTANCE</Text>
          <Text style={[s.statValue, { left: 24, top: 197 }]}>{distanceStr}</Text>

          <Text style={[s.statLabel, { left: 24, top: 245 }]}>DAYS ON TRACK</Text>
          <Text style={[s.statValue, { left: 24, top: 269 }]}>{daysStr}</Text>

          <Text style={[s.statLabel, { left: 24, top: 317 }]}>BEST QUALIFYING</Text>
          {/* top: 341 → bottom = 341+24 = 365, gap from card bottom (389) = 24px ✓ */}
          <Text style={[s.statValue, { left: 24, top: 341 }]}>{bestQualStr}</Text>
        </View>

        {/* #N RACER — OUTSIDE overflow:hidden, 10px from visual card right.
            right: 2 (stroke bleed) + 10 (gap) = 12px from SVG right.
            Visual dimensions after -90deg rotation: 16px wide, 83px tall.
            Position: 74px gap from card visual bottom (y=391 in SVG).
              visual text bottom = 391 - 74 = 317
              visual text top    = 317 - 83 = 234  →  top: 234 in SVG container
            Wrapper is exactly 16×83 so justifyContent/alignItems center the original
            83×16 text and rotation lines up perfectly. */}
        <View
          style={{
            position: 'absolute',
            right: 12,
            top: 234,
            width: 16,
            height: 83,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={s.racerLabel}>
            #{profile.raceNumber} RACER
          </Text>
        </View>
      </View>

      {/* ── Settings List ── */}

      {/* Notifications */}
      <View style={[s.listRow, { top: py(539) }]}>
        <Text style={s.listLabel}>Notifications</Text>
        <View style={{ position: 'absolute', right: 20 }}>
          <AnimatedToggle
            on={notificationsEnabled}
            onToggle={() => setNotificationsEnabled(!notificationsEnabled)}
          />
        </View>
      </View>

      {/* Terms & Privacy */}
      <View style={[s.listRow, { top: py(587) }]}>
        <Text style={s.listLabel}>Terms &amp; Privacy</Text>
        <View style={{ position: 'absolute', right: 24, justifyContent: 'center', alignSelf: 'center' }}>
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d={ARROW_PATH} stroke="white" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
          </Svg>
        </View>
      </View>

      {/* Send Feedback */}
      <View style={[s.listRow, { top: py(635) }]}>
        <Text style={s.listLabel}>Send Feedback</Text>
        <View style={{ position: 'absolute', right: 24, justifyContent: 'center', alignSelf: 'center' }}>
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d={ARROW_PATH} stroke="white" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
          </Svg>
        </View>
      </View>

      {/* Version */}
      <Text style={[s.version, { top: py(683) }]}>Version {APP_VERSION}</Text>

      {/* ── Gradient fade — Defs 없이 Rect 단계별 렌더 ── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  name: {
    fontFamily: 'Formula1-Bold',
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  racerLabel: {
    width: 83,
    height: 16,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
    textAlign: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  statLabel: {
    position: 'absolute',
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 13 * -0.02,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  statValue: {
    position: 'absolute',
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  listRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
  },
  listLabel: {
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    opacity: 0.7,
    includeFontPadding: false,
  },
  version: {
    position: 'absolute',
    left: 20,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: '#FFFFFF',
    opacity: 0.3,
    includeFontPadding: false,
  },
});
