import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
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
import { useAppStore } from '../store/appStore';
import { useTabBarTotalHeight } from '../components/TabBar';
import { signOut } from '../platform/auth';
import type { ProfileScreenProps } from '../navigation/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ARROW_PATH =
  'M1.5 1.5L7.71084 7.26721C8.1369 7.66284 8.1369 8.33716 7.71084 8.73279L1.5 14.5';

const TROPHY_IMAGES: Record<string, ReturnType<typeof require>> = {
  f1_champion: require('../../assets/qualifying/trophy/f1-champion.png'),
  f1: require('../../assets/qualifying/trophy/f1.png'),
  f1_rookie: require('../../assets/qualifying/trophy/f1-rookie.png'),
  f2: require('../../assets/qualifying/trophy/f2.png'),
  f3: require('../../assets/qualifying/trophy/f3.png'),
};

const APP_VERSION: string = (
  require('../../app.json') as { expo: { version: string } }
).expo.version;

// ─── AnimatedToggle ───────────────────────────────────────────────────────────

function AnimatedToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: on ? 1 : 0,
      useNativeDriver: false,
      friction: 10,
      tension: 100,
    }).start();
  }, [on, anim]);

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.1)', 'rgba(224,58,62,0.3)'],
  });
  const circleX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
  const circleColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,1)', 'rgba(224,58,62,1)'],
  });
  const circleSize = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 24] });
  const circleTop = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });

  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Animated.View
        style={{ width: 48, height: 24, borderRadius: 12, backgroundColor: bgColor, overflow: 'hidden' }}
      >
        <Animated.View style={{ position: 'absolute', width: 24, height: 24, transform: [{ translateX: circleX }] }}>
          <Animated.View
            style={{
              position: 'absolute', left: 0, right: 0, top: circleTop,
              width: circleSize, alignSelf: 'center', height: circleSize,
              borderRadius: 12, backgroundColor: circleColor,
            }}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─── TeamSvg ──────────────────────────────────────────────────────────────────

function TeamSvg({ color, width }: { color: string; width: number }) {
  return (
    <Svg width={width} height={33} viewBox="0 0 401 33">
      <Defs>
        <SvgLG id="teamGrad" x1="0" y1="16.5" x2="401" y2="16.5" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={color} stopOpacity="0" />
          <Stop offset="50%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgLG>
      </Defs>
      <Path
        d="M0 32H282.668C286.063 32 289.298 30.5624 291.574 28.0434L312.426 4.95657C314.702 2.43757 317.937 1 321.332 1H401"
        stroke="url(#teamGrad)"
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

// ─── ListRow ──────────────────────────────────────────────────────────────────

function ChevronRight({ opacity = 0.5 }: { opacity?: number }) {
  return (
    <View style={{ position: 'absolute', right: 24, justifyContent: 'center', alignSelf: 'center' }}>
      <Svg width={10} height={16} viewBox="0 0 10 16">
        <Path d={ARROW_PATH} stroke="white" strokeWidth={3} strokeLinecap="round" fill="none" opacity={opacity} />
      </Svg>
    </View>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const tabH = useTabBarTotalHeight();

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

  const profile                 = useAppStore((s) => s.profile);
  const qualifyingResult        = useAppStore((s) => s.qualifyingResult);
  const notificationsEnabled    = useAppStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled);

  const trophySource = qualifyingResult
    ? (TROPHY_IMAGES[qualifyingResult.grade] ?? TROPHY_IMAGES.f3)
    : TROPHY_IMAGES.f3;

  const handleSignOut = () => {
    signOut().then(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
    }).catch(() => {});
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#17171C', opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabH + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. 트로피 + 레이서 정보 ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: safeTop + 61, marginLeft: 22, marginRight: 20 }}>
          <Image source={trophySource} style={{ width: 40, height: 43, marginTop: -1 }} resizeMode="contain" />
          <View style={{ marginLeft: 12 }}>
            <Text style={s.racerNumber}>#{profile.raceNumber}</Text>
            <Text style={s.racerName}>{profile.displayName}</Text>
          </View>
        </View>

        {/* ── 2. 팀 SVG ── */}
        <View style={{ marginTop: -12 }}>
          <TeamSvg color={profile.nameTagAccentColor} width={windowW} />
        </View>

        {/* ── 3. 설정 리스트 ── */}
        <View style={{ marginTop: 28 }}>
          {/* Notifications */}
          <View style={s.listRow}>
            <Text style={s.listLabel}>Notifications</Text>
            <View style={{ position: 'absolute', right: 20 }}>
              <AnimatedToggle
                on={notificationsEnabled}
                onToggle={() => setNotificationsEnabled(!notificationsEnabled)}
              />
            </View>
          </View>

          {/* Terms & Privacy */}
          <View style={[s.listRow, { marginTop: 24 }]}>
            <Text style={s.listLabel}>Terms &amp; Privacy</Text>
            <ChevronRight />
          </View>

          {/* Send Feedback */}
          <View style={[s.listRow, { marginTop: 24 }]}>
            <Text style={s.listLabel}>Send Feedback</Text>
            <ChevronRight />
          </View>

          {/* Sign Out */}
          <Pressable style={[s.listRow, { marginTop: 24 }]} onPress={handleSignOut}>
            <Text style={[s.listLabel, { color: 'rgba(255,255,255,0.4)' }]}>Sign Out</Text>
            <ChevronRight opacity={0.3} />
          </Pressable>

          {/* Version */}
          <Text style={[s.version, { marginTop: 24 }]}>Version {APP_VERSION}</Text>
        </View>
      </ScrollView>

      {/* ── Gradient fade (탭바 위) ── */}
      <Svg
        width={windowW}
        height={48}
        style={{ position: 'absolute', bottom: tabH, left: 0 }}
        pointerEvents="none"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Rect key={i} x={0} y={i * 6} width={windowW} height={6} fill="#17171C" fillOpacity={i / 7} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  racerNumber: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.02 * 13,
    color: '#FFFFFF',
    opacity: 0.5,
    includeFontPadding: false,
  },
  racerName: {
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.02 * 24,
    color: '#FFFFFF',
    includeFontPadding: false,
    marginTop: 4,
  },
  listRow: {
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
    paddingLeft: 20,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: '#FFFFFF',
    opacity: 0.3,
    includeFontPadding: false,
  },
});
