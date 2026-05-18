import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from '../platform/blur';
import { CARD_FILL } from './GradientCardBorder';
import { PALETTE } from '../constants/colors';
import { radius } from '../constants/radius';

const ACCENT = PALETTE.red;

interface ConfirmSheetProps {
  /** 제목 텍스트 */
  title: string;
  /** 보조 설명 텍스트 */
  description: string;
  /** 왼쪽 버튼 라벨 (취소/머무름) */
  secondaryLabel: string;
  /** 오른쪽 버튼 라벨 (destructive 액션) */
  primaryLabel: string;
  /** 왼쪽 버튼 누름 — dismiss 애니메이션 끝난 후 호출 */
  onSecondary: () => void;
  /** 오른쪽 버튼 누름 — dismiss 애니메이션 끝난 후 호출 */
  onPrimary: () => void;
}

/**
 * 재사용 가능 확인 바텀시트.
 * QualifyingScreen retire / ProfileScreen delete account 둘 다 사용.
 * 외부에서 conditional render로 mount / unmount 제어.
 */
export default function ConfirmSheet({
  title,
  description,
  secondaryLabel,
  primaryLabel,
  onSecondary,
  onPrimary,
}: ConfirmSheetProps) {
  const modalRadius = 24;
  const innerPad = 28;

  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) callback();
    });
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            borderRadius: modalRadius,
            transform: [{ translateY: slideAnim }],
            backgroundColor: 'transparent',
            overflow: 'hidden',
          },
        ]}
      >
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: CARD_FILL }]} />

        <Text
          style={[styles.title, { paddingHorizontal: innerPad }]}
          allowFontScaling={false}
        >
          {title}
        </Text>

        <Text
          style={[styles.description, { paddingHorizontal: innerPad, marginTop: 24 }]}
          allowFontScaling={false}
        >
          {description}
        </Text>

        <View style={[styles.btnsRow, { marginTop: 32 }]}>
          <Pressable
            onPress={() => dismiss(onSecondary)}
            style={[styles.btn, styles.secondaryBtn, radius.sm]}
          >
            <Text
              style={[styles.btnLabel, { color: PALETTE.white }]}
              allowFontScaling={false}
            >
              {secondaryLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => dismiss(onPrimary)}
            style={[styles.btn, styles.primaryBtn, radius.sm]}
          >
            <Text
              style={[styles.btnLabel, { color: ACCENT }]}
              allowFontScaling={false}
            >
              {primaryLabel}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#202028',
    marginHorizontal: 20,
    marginBottom: 26,
    paddingTop: 32,
    paddingBottom: 20,
  },
  title: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Regular',
    fontStyle: 'italic',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  description: {
    color: PALETTE.white,
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  btnsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  secondaryBtn: {
    backgroundColor: '#34343F',
  },
  primaryBtn: {
    backgroundColor: 'rgba(224,58,62,0.3)',
  },
  btnLabel: {
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    letterSpacing: -0.22,
    includeFontPadding: false,
  },
});
