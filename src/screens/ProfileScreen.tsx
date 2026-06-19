import { COLORS, PALETTE } from '../constants/colors';
import { LETTER_SPACING } from '../constants/typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
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
import { dismissInAppBrowser, openInAppBrowser } from '../platform/webBrowser';
import FeedbackToast from '../components/FeedbackToast';
import ConfirmSheet from '../components/ConfirmSheet';
import { deleteAccount } from '../api/account';
import { clearAllStorage } from '../platform/storage';
import type { ProfileScreenProps } from '../navigation/types';

const FEEDBACK_REDIRECT_SCHEME = 'pitrun://feedback-submitted';

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

const TERMS_URL = 'https://brawny-camp-928.notion.site/Terms-of-Service-359fe2177fce80bf9d3ec3a7ca95dc96';
const PRIVACY_URL = 'https://brawny-camp-928.notion.site/Privacy-Policy-359fe2177fce80098b73da31906382d5';
const FEEDBACK_URL = 'https://tally.so/r/Gxqzz2';

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
  const engineSoundEnabled      = useAppStore((s) => s.engineSoundEnabled);
  const setEngineSoundEnabled   = useAppStore((s) => s.setEngineSoundEnabled);

  const trophySource = qualifyingResult
    ? (TROPHY_IMAGES[qualifyingResult.grade] ?? null)
    : null;

  const handleSignOut = () => {
    signOut().then(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
    }).catch(() => {});
  };

  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  // Engine Sound 토글: 켜기는 즉시, 끄기는 ConfirmSheet 경유(잠금 중 알림 누락 경고).
  const [showEngineSheet, setShowEngineSheet] = useState(false);
  const handleEngineToggle = () => {
    if (engineSoundEnabled) {
      // ON → OFF: 바로 끄지 않고 확인 시트
      setShowEngineSheet(true);
    } else {
      // OFF → ON: 즉시 켜기
      setEngineSoundEnabled(true);
    }
  };

  const handleConfirmDelete = async () => {
    setShowDeleteSheet(false);
    try {
      await deleteAccount();
      clearAllStorage();
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
    } catch (e) {
      Alert.alert(
        'Deletion failed',
        e instanceof Error ? e.message : 'Please try again later.',
      );
    }
  };

  const [feedbackToastVisible, setFeedbackToastVisible] = useState(false);
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith(FEEDBACK_REDIRECT_SCHEME)) {
        dismissInAppBrowser();
        setFeedbackToastVisible(true);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabH + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. 트로피(있을 때만) + 레이서 정보 + 팀 SVG (탭 → 프로필 수정) ── */}
        <Pressable onPress={() => navigation.navigate('ProfileEdit')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: safeTop + 61, marginLeft: 22, marginRight: 20 }}>
            {trophySource && (
              <Image source={trophySource} style={{ width: 40, height: 43, marginTop: -1 }} resizeMode="contain" />
            )}
            <View style={{ marginLeft: trophySource ? 12 : 0 }}>
              <Text style={styles.racerNumber}>#{profile.raceNumber}</Text>
              <Text style={styles.racerName}>{profile.displayName}</Text>
            </View>
          </View>

          {/* ── 2. 팀 SVG ── */}
          <View style={{ marginTop: -12 }}>
            <TeamSvg color={profile.nameTagAccentColor} width={windowW} />
          </View>
        </Pressable>

        {/* ── 3. 설정 리스트 ── */}
        <View style={{ marginTop: 28 }}>
          {/* Engine Sound */}
          <View style={styles.listRow}>
            <Text style={styles.listLabel}>Engine Sound</Text>
            <View style={{ position: 'absolute', right: 20 }}>
              <AnimatedToggle
                on={engineSoundEnabled}
                onToggle={handleEngineToggle}
              />
            </View>
          </View>

          {/* Terms of Service */}
          <Pressable
            style={[styles.listRow, { marginTop: 24 }]}
            onPress={() => openInAppBrowser(TERMS_URL)}
          >
            <Text style={styles.listLabel}>Terms of Service</Text>
            <ChevronRight />
          </Pressable>

          {/* Privacy Policy */}
          <Pressable
            style={[styles.listRow, { marginTop: 24 }]}
            onPress={() => openInAppBrowser(PRIVACY_URL)}
          >
            <Text style={styles.listLabel}>Privacy Policy</Text>
            <ChevronRight />
          </Pressable>

          {/* Send Feedback */}
          <Pressable
            style={[styles.listRow, { marginTop: 24 }]}
            onPress={() => openInAppBrowser(FEEDBACK_URL)}
          >
            <Text style={styles.listLabel}>Send Feedback</Text>
            <ChevronRight />
          </Pressable>

          {/* Sign Out */}
          <Pressable style={[styles.listRow, { marginTop: 24 }]} onPress={handleSignOut}>
            <Text style={[styles.listLabel, { color: 'rgba(255,255,255,0.4)' }]}>Sign Out</Text>
            <ChevronRight opacity={0.3} />
          </Pressable>

          {/* Delete account */}
          <Pressable
            style={[styles.listRow, { marginTop: 24 }]}
            onPress={() => setShowDeleteSheet(true)}
          >
            <Text style={[styles.listLabel, { color: 'rgba(255,255,255,0.4)' }]}>Delete account</Text>
            <ChevronRight opacity={0.3} />
          </Pressable>

          {/* Version */}
          <Text style={[styles.version, { marginTop: 24 }]}>Version {APP_VERSION}</Text>

          {/* Disclaimer */}
          <Text style={[styles.version, { marginTop: 12 }]}>
            PIT RUN is not affiliated with Formula 1.{'\n'}
            F1® is a trademark of Formula One Licensing BV.
          </Text>
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
          <Rect key={i} x={0} y={i * 6} width={windowW} height={6} fill={COLORS.bg} fillOpacity={i / 7} />
        ))}
      </Svg>

      <FeedbackToast
        visible={feedbackToastVisible}
        message="Thank you for your feedback!"
        onDismiss={() => setFeedbackToastVisible(false)}
      />

      {showDeleteSheet && (
        <ConfirmSheet
          title="End your career?"
          description="This deletes your profile, grade, and all race history. There's no undo."
          secondaryLabel="Stay"
          primaryLabel="Delete"
          onSecondary={() => setShowDeleteSheet(false)}
          onPrimary={handleConfirmDelete}
        />
      )}

      {showEngineSheet && (
        <ConfirmSheet
          title="Turn off Engine Sound?"
          description="You may miss interval alerts while your screen is locked."
          secondaryLabel="Keep On"
          primaryLabel="Turn Off"
          onSecondary={() => setShowEngineSheet(false)}
          onPrimary={() => {
            setEngineSoundEnabled(false);
            setShowEngineSheet(false);
          }}
        />
      )}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  racerNumber: {
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: LETTER_SPACING.display(13),
    color: PALETTE.white,
    opacity: 0.5,
    includeFontPadding: false,
  },
  racerName: {
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: LETTER_SPACING.display(24),
    color: PALETTE.white,
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
    color: PALETTE.white,
    opacity: 0.7,
    includeFontPadding: false,
  },
  version: {
    paddingLeft: 20,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: PALETTE.white,
    opacity: 0.3,
    includeFontPadding: false,
  },
});
