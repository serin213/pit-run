import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

import { getDriverCode } from '../utils/driverCode';
import { radius } from '../constants/radius';
import GradientCtaButton from '../components/GradientCtaButton';
import { useAppStore } from '../store/appStore';
import { useSupabaseProfile } from '../hooks/useSupabaseProfile';
import { getCurrentUser } from '../platform/auth';
import { logOnboardingCompleted } from '../lib/analytics/raceEvents';
import type { ProfileSetupScreenProps } from '../navigation/types';
import { useProfileValidation } from '../hooks/useProfileValidation';
import { COLORS } from '../constants/colors';

const TEAM_COLORS = ['#E03A8A', '#E03A3E', '#FF8716', '#FCB827', '#59B345', '#04CBBA', '#3F5CFF', '#8528C5', '#FFFFFF'] as const;
const PREVIEW_DEFAULT_COLOR = '#7C7C88';
const PREVIEW_CARD_H = 83; // previewSection(119) - label(24) - gap(12)

export default function ProfileSetupScreen({ navigation }: ProfileSetupScreenProps) {
  const { setProfile } = useAppStore();
  const { save } = useSupabaseProfile();
  const { width: windowW } = useWindowDimensions();
  const contentWidth = Math.max(0, windowW - 40);
  const ctaContainerH = 164;
  const ctaHeight = 54;
  const nameRef = useRef<TextInput | null>(null);
  const numberRef = useRef<TextInput | null>(null);

  const {
    displayName, raceNumber, teamColor, setTeamColor,
    trimmedName, normalizedNumber, canSubmit,
    nameError, numberError,
    nameShakeX, numberShakeX, nameFocusSpread, numberFocusSpread,
    onChangeName, onChangeNumber,
    onFocusName, onBlurName, onFocusNumber, onBlurNumber,
  } = useProfileValidation({ requireColor: true });

  const previewCode = useMemo(() => getDriverCode(displayName), [displayName]);
  const previewNumber = normalizedNumber || '00';
  const previewColor = teamColor ?? PREVIEW_DEFAULT_COLOR;

  return (
    <View style={[styles.container, { paddingBottom: ctaContainerH }]}>
      <Text style={styles.title}>PIT RUN</Text>

      <View style={styles.formWrap}>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Name</Text>
          <View style={styles.inputLineWrap}>
            <TextInput
              ref={nameRef}
              value={displayName}
              onChangeText={onChangeName}
              onFocus={onFocusName}
              onBlur={onBlurName}
              onSubmitEditing={() => {
                onBlurName();
                numberRef.current?.focus();
              }}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              keyboardType="ascii-capable"
              returnKeyType="next"
              selectionColor="#FFFFFF"
              placeholder=""
              style={[styles.inputText, styles.inputNoOutline]}
            />
            <Animated.View style={[styles.inputUnderlineTrack, { transform: [{ translateX: nameShakeX }] }, nameError ? styles.inputUnderlineError : null]}>
              <Animated.View
                style={[
                  styles.inputUnderlineSpread,
                  {
                    transform: [{ scaleX: nameFocusSpread }],
                    opacity: nameError ? 0 : nameFocusSpread,
                  },
                ]}
              />
            </Animated.View>
          </View>
          {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Racer Number</Text>
          <View style={styles.inputLineWrap}>
            <TextInput
              ref={numberRef}
              value={raceNumber}
              onChangeText={onChangeNumber}
              onFocus={onFocusNumber}
              onBlur={onBlurNumber}
              onSubmitEditing={onBlurNumber}
              keyboardType="number-pad"
              returnKeyType="done"
              selectionColor="#FFFFFF"
              placeholder=""
              style={[styles.inputText, styles.inputNoOutline]}
            />
            <Animated.View style={[styles.inputUnderlineTrack, { transform: [{ translateX: numberShakeX }] }, numberError ? styles.inputUnderlineError : null]}>
              <Animated.View
                style={[
                  styles.inputUnderlineSpread,
                  {
                    transform: [{ scaleX: numberFocusSpread }],
                    opacity: numberError ? 0 : numberFocusSpread,
                  },
                ]}
              />
            </Animated.View>
          </View>
          {!!numberError && <Text style={styles.errorText}>{numberError}</Text>}
        </View>

        <View style={styles.teamSection}>
          <Text style={styles.fieldLabel}>Team Color</Text>
          <View style={styles.colorRow}>
            {TEAM_COLORS.map((color) => {
              const selected = color === teamColor;
              return (
                <Pressable
                  key={color}
                  onPress={() => setTeamColor(teamColor === color ? null : color)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    teamColor && !selected ? styles.colorSwatchDimmed : null,
                    selected && styles.colorSwatchSelected,
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.previewSection}>
          <Text style={styles.previewLabel}>Preview</Text>
          <View style={[styles.previewCard, { width: contentWidth }]}>
            <Svg
              width={contentWidth}
              height={PREVIEW_CARD_H}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                <SvgLinearGradient id="previewCardBorder" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={contentWidth} y2={PREVIEW_CARD_H}>
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                  <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.06" />
                  <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.06" />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x={0.5} y={0.5}
                width={contentWidth - 1} height={PREVIEW_CARD_H - 1}
                rx={11.5} ry={11.5}
                fill="none"
                stroke="url(#previewCardBorder)"
                strokeWidth={0.5}
              />
            </Svg>
            <View style={styles.previewCardInner}>
              <View style={styles.previewRow}>
                <View style={[styles.previewAccent, { backgroundColor: previewColor }]} />
                <Text style={styles.previewName}>{previewCode}</Text>
              </View>
              <Text style={styles.previewNumber}>#{previewNumber}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom CTA area — absolute overlay with fade gradient */}
      <View style={[styles.ctaContainer, { height: ctaContainerH }]} pointerEvents="box-none">
        <Svg
          width={windowW}
          height={ctaContainerH}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient id="profileFade" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="66%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="100%" stopColor="#17171C" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={windowW} height={ctaContainerH} fill="url(#profileFade)" />
        </Svg>
        <View style={[styles.ctaBtnWrap, { bottom: 40 }]}>
          <GradientCtaButton
            width={contentWidth}
            height={ctaHeight}
            label="MAKE DEBUT"
            enabled={canSubmit}
            onPress={() => {
              setProfile({
                displayName: trimmedName,
                raceNumber: normalizedNumber,
                nameTagAccentColor: teamColor ?? PREVIEW_DEFAULT_COLOR,
              });
              save({
                display_name: trimmedName,
                race_number: normalizedNumber,
                accent_color: teamColor ?? PREVIEW_DEFAULT_COLOR,
              }).catch(() => {});
              getCurrentUser().then((user) => {
                if (user?.id) {
                  logOnboardingCompleted({ userId: user.id }).catch(() => {});
                }
              }).catch(() => {});
              navigation.replace('Home');
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
    paddingTop: 100,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  ctaBtnWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  title: {
    fontSize: 36,
    lineHeight: 43,
    fontFamily: 'Formula1-Bold',
    color: '#FFFFFF',
    letterSpacing: -0.36,
    includeFontPadding: false,
  },
  formWrap: {
    width: '100%',
    height: 473,
    gap: 48,
  },
  fieldBlock: {
    width: '100%',
    gap: 10,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20.4,
    includeFontPadding: false,
  },
  inputLineWrap: {
    width: '100%',
    gap: 4,
  },
  inputText: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    minHeight: 29,
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  inputNoOutline: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...( { outlineStyle: 'none', outlineWidth: 0 } as any ),
  },
  inputUnderlineTrack: {
    width: '100%',
    height: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  inputUnderlineSpread: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    transform: [{ scaleX: 0 }],
  },
  inputUnderlineError: {
    backgroundColor: COLORS.soft,
  },
  errorText: {
    color: COLORS.soft,
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    lineHeight: 14,
    marginTop: -2,
    marginBottom: 2,
  },
  teamSection: {
    width: '100%',
    height: 66,
    gap: 18,
  },
  colorRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  colorSwatchDimmed: {
    opacity: 0.3,
  },
  previewSection: {
    width: '100%',
    height: 119,
    gap: 12,
  },
  previewLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
  previewCard: {
    height: PREVIEW_CARD_H,
    ...radius.sm,
  },
  previewCardInner: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    ...radius.sm,
    borderRadius: radius.sm.borderRadius - 1,
    backgroundColor: 'rgba(32,32,40,0.4)',
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  previewAccent: {
    width: 11.25,
    height: 37.5,
  },
  previewName: {
    color: '#FFFFFF',
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    includeFontPadding: false,
  },
  previewNumber: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
});
