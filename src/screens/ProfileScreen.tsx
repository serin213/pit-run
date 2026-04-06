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
  Path,
  Rect,
} from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import { useAppStore } from '../store/appStore';
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

// ─── Tab icon SVG paths ───────────────────────────────────────────────────────

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

const ARROW_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

// ─── Grade badge images ───────────────────────────────────────────────────────

const GRADE_BADGES = {
  A: require('../../assets/grade-f1-rainbow.png') as ReturnType<typeof require>,
  B: require('../../assets/grade-f1-purple.png') as ReturnType<typeof require>,
  C: require('../../assets/grade-f1-green.png') as ReturnType<typeof require>,
  D: require('../../assets/grade-f2.png') as ReturnType<typeof require>,
  none: require('../../assets/grade-unranked.png') as ReturnType<typeof require>,
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FIGMA_STATUS = 59;
const FIGMA_TAB_H = 98;
const FIGMA_SAFE_BOTTOM = 34;
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
  const cardW = windowW - 64;
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

  // ─── Tab bar ──────────────────────────────────────────────────────────────
  const tabH = FIGMA_TAB_H - FIGMA_SAFE_BOTTOM + safeBottom;
  const tabZoneW = windowW / 4;
  const homeLeft = Math.round(tabZoneW * 0 + (tabZoneW - 32) / 2);
  const playLeft = Math.round(tabZoneW * 1 + (tabZoneW - 32) / 2);
  const taskLeft = Math.round(tabZoneW * 2 + (tabZoneW - 32) / 2);
  const userLeft = Math.round(tabZoneW * 3 + (tabZoneW - 32) / 2);
  const activeBarLeft = userLeft - 16;
  const glowW = Math.round(tabZoneW);
  const glowHalf = Math.max(0, (glowW - 64) / 2);
  const glowLeft = Math.round(tabZoneW * 3);

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

  // ─── Tab bar entry animations ─────────────────────────────────────────────
  // 탭바 바 애니메이션 (글로우는 정적 opacity 0.2)
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

      {/* ── Driver Card ── */}
      <View
        style={{
          position: 'absolute',
          left: 30,
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
          <Path
            d={cardPath}
            fill="#202028"
            stroke={profile.nameTagAccentColor}
            strokeOpacity={0.3}
            strokeWidth={4}
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
        <View style={{ position: 'absolute', right: 28 }}>
          <AnimatedToggle
            on={notificationsEnabled}
            onToggle={() => setNotificationsEnabled(!notificationsEnabled)}
          />
        </View>
      </View>

      {/* Terms & Privacy */}
      <View style={[s.listRow, { top: py(587) }]}>
        <Text style={s.listLabel}>Terms &amp; Privacy</Text>
        <View style={{ position: 'absolute', right: 32, justifyContent: 'center', alignSelf: 'center' }}>
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d={ARROW_PATH} stroke="white" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
          </Svg>
        </View>
      </View>

      {/* Send Feedback */}
      <View style={[s.listRow, { top: py(635) }]}>
        <Text style={s.listLabel}>Send Feedback</Text>
        <View style={{ position: 'absolute', right: 32, justifyContent: 'center', alignSelf: 'center' }}>
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

      {/* ── Tab bar ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: tabH,
          backgroundColor: '#202028',
        }}
      >
        {/* User tab 사다리꼴 글로우 — 위→아래 그라데이션, Defs/id 미사용 */}
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

        {/* Active indicator bar — grows left → right via scaleX + translateX pivot */}
        <Animated.View
          style={{
            position: 'absolute',
            left: activeBarLeft,
            top: 0,
            width: 64,
            height: 2,
            backgroundColor: '#E03A3E',
            transform: [
              { translateX: barTranslateX },
              { scaleX: barAnim },
            ],
          }}
        />

        {/* home */}
        <Pressable
          style={{ position: 'absolute', left: homeLeft, top: 20 }}
          onPress={() => navigation.navigate('Home')}
        >
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={HOME_P1} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={HOME_P2} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        {/* play */}
        <Pressable
          style={{ position: 'absolute', left: playLeft, top: 20 }}
          onPress={() => navigation.navigate('Race')}
        >
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={PLAY_P} stroke="#FFFFFF" strokeWidth={2.25} strokeLinejoin="round" />
          </Svg>
        </Pressable>

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

        {/* user (active → red) */}
        <View style={{ position: 'absolute', left: userLeft, top: 20 }}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <Path d={USER_P1} stroke="#E03A3E" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={USER_P2} stroke="#E03A3E" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
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
    paddingLeft: 28,
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
    left: 28,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: '#FFFFFF',
    opacity: 0.3,
    includeFontPadding: false,
  },
});
