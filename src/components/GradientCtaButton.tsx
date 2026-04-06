import React, { useRef } from 'react';

let _ctaBtnId = 0;
import { Animated, Easing, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

type GradientCtaButtonSingleProps = {
  variant?: 'single';
  width: number;
  label: string;
  enabled: boolean;
  onPress: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
  textButtonType?: 'none' | 'text' | 'checkbox';
  textButtonLabel?: string;
  textButtonChecked?: boolean;
  onPressTextButton?: () => void;
  gradientStart?: string;
  gradientEnd?: string;
};

/** PITS + START 한 줄 (Figma 987:3121) */
type GradientCtaButtonDualProps = {
  variant: 'dual';
  width: number;
  dualLeftLabel?: string;
  dualRightLabel?: string;
  onPressLeft: () => void;
  onPressRight: () => void;
  height?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

export type GradientCtaButtonProps = GradientCtaButtonSingleProps | GradientCtaButtonDualProps;

const GLOW_EXTRA_WIDTH = 160;
const GLOW_HEIGHT = 158;
const GLOW_BOTTOM_OFFSET = -65;

export default function GradientCtaButton(props: GradientCtaButtonProps) {
  if (props.variant === 'dual') {
    return (
      <DualSplitCtaRow
        width={props.width}
        height={props.height}
        gap={props.gap}
        style={props.style}
        leftLabel={props.dualLeftLabel}
        rightLabel={props.dualRightLabel}
        onPressLeft={props.onPressLeft}
        onPressRight={props.onPressRight}
      />
    );
  }

  const {
    width,
    label,
    enabled,
    onPress,
    height = 58,
    style,
    textButtonType = 'none',
    textButtonLabel = 'On a Treadmil?',
    textButtonChecked = false,
    onPressTextButton,
    gradientStart = '#E03A3E',
    gradientEnd = '#FF4D51',
  } = props;

  const gradientId = useRef(`gradientCta_${++_ctaBtnId}`).current;
  const glowId = useRef(`gradientCtaGlow_${_ctaBtnId}`).current;
  const pressAnim = useRef(new Animated.Value(0)).current;
  const showTextButton = textButtonType !== 'none';
  const showCheckbox = textButtonType === 'checkbox';
  const buttonScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.985],
  });

  const animatePress = (pressed: boolean) => {
    Animated.timing(pressAnim, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? 95 : 150,
      easing: pressed ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.wrap, { width }, style]}>
      {showTextButton && (
        <Pressable
          onPress={onPressTextButton}
          style={styles.textButtonRow}
          disabled={!onPressTextButton}
          hitSlop={8}
        >
          {showCheckbox && (
            <View style={[styles.checkboxBase, textButtonChecked ? styles.checkboxChecked : null]}>
              {textButtonChecked && (
                <Svg width={10} height={7} viewBox="0 0 10 7">
                  <Path
                    d="M1 3L3.29289 5.29289C3.68342 5.68342 4.31658 5.68342 4.70711 5.29289L9 1"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              )}
            </View>
          )}
          <Text style={styles.textButtonLabel}>{textButtonLabel}</Text>
        </Pressable>
      )}

      {enabled && (
        <Svg
          width={width + GLOW_EXTRA_WIDTH}
          height={GLOW_HEIGHT}
          viewBox={`0 0 ${width + GLOW_EXTRA_WIDTH} ${GLOW_HEIGHT}`}
          style={styles.glow}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={gradientStart} stopOpacity="1" />
              <Stop offset="100%" stopColor={gradientStart} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={width + GLOW_EXTRA_WIDTH} height={GLOW_HEIGHT} fill={`url(#${glowId})`} opacity="0.3" />
        </Svg>
      )}

      <Animated.View
        style={[
          styles.pressAnimWrap,
          {
            transform: [{ scale: buttonScale }],
          },
        ]}
      >
        <Pressable
          disabled={!enabled}
          onPress={onPress}
          onPressIn={() => enabled && animatePress(true)}
          onPressOut={() => enabled && animatePress(false)}
          style={[styles.press, { height }]}
        >
          <Svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={StyleSheet.absoluteFill}
          >
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="72%">
              <Stop offset="27%" stopColor={gradientStart} />
              <Stop offset="100%" stopColor={gradientEnd} />
            </RadialGradient>
          </Defs>
            <Rect
              x="0"
              y="0"
              width={width}
              height={height}
              rx="12"
              fill={`url(#${gradientId})`}
              fillOpacity={enabled ? 1 : 0.3}
            />
          </Svg>
          <Text
            style={[styles.btnLabel, { opacity: enabled ? 1 : 0.3 }]}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  textButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  textButtonLabel: {
    color: '#FFFFFF',
    opacity: 0.5,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 1,
    includeFontPadding: false,
  },
  checkboxBase: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#E03A3E',
  },
  press: {
    width: '100%',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    includeFontPadding: false,
    letterSpacing: -0.22,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1,
  },
  pressAnimWrap: {
    width: '100%',
  },
  glow: {
    position: 'absolute',
    bottom: GLOW_BOTTOM_OFFSET,
    left: -80,
  },
});

// ─── Dual row (PITS + START) — Figma 987:3121 ────────────────────────────────

type DualSplitCtaRowProps = {
  /** 스케일되는 전체 가로 (보통 화면폭 − 좌우 패딩) */
  width: number;
  leftLabel?: string;
  rightLabel?: string;
  onPressLeft: () => void;
  onPressRight: () => void;
  height?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

function DualSplitCtaRow({
  width,
  leftLabel = 'PITS',
  rightLabel = 'START',
  onPressLeft,
  onPressRight,
  height = 58,
  gap = 16,
  style,
}: DualSplitCtaRowProps) {
  const leftPress = useRef(new Animated.Value(0)).current;
  const rightPress = useRef(new Animated.Value(0)).current;

  const leftScale = leftPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });
  const rightScale = rightPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });

  const pulse = (v: Animated.Value, pressed: boolean) => {
    Animated.timing(v, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? 95 : 150,
      easing: pressed ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[{ flexDirection: 'row', width, gap }, style]}>
      <Animated.View style={{ flex: 1, transform: [{ scale: leftScale }] }}>
        <Pressable
          onPress={onPressLeft}
          onPressIn={() => pulse(leftPress, true)}
          onPressOut={() => pulse(leftPress, false)}
          style={[dualStyles.halfBtn, dualStyles.pitsBtn, { height, borderRadius: 12 }]}
        >
          <Text style={dualStyles.dualLabel} allowFontScaling={false}>
            {leftLabel}
          </Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={{ flex: 1, transform: [{ scale: rightScale }] }}>
        <Pressable
          onPress={onPressRight}
          onPressIn={() => pulse(rightPress, true)}
          onPressOut={() => pulse(rightPress, false)}
          style={[dualStyles.halfBtn, dualStyles.startBtn, { height, borderRadius: 12 }]}
        >
          <Text style={dualStyles.dualLabel} allowFontScaling={false}>
            {rightLabel}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const dualStyles = StyleSheet.create({
  halfBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pitsBtn: {
    backgroundColor: '#34343F',
  },
  startBtn: {
    backgroundColor: '#E03A3E',
  },
  dualLabel: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
    includeFontPadding: false,
  },
});
