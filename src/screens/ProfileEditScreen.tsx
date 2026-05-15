import React, { useMemo, useRef } from 'react';
import TopSafeBlurOverlay from '../components/TopSafeBlurOverlay';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLG, Rect, Stop } from 'react-native-svg';
import GradientCtaButton from '../components/GradientCtaButton';
import CtaFadeBackground, { CTA_AREA_HEIGHT } from '../components/CtaFadeBackground';
import BackButton from '../components/BackButton';
import { getDriverCode } from '../utils/driverCode';
import { useAppStore } from '../store/appStore';
import { useSupabaseProfile } from '../hooks/useSupabaseProfile';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import type { ProfileEditScreenProps } from '../navigation/types';
import GradientCardBorder from '../components/GradientCardBorder';
import { useProfileValidation } from '../hooks/useProfileValidation';
import { COLORS, PALETTE, PREVIEW_DEFAULT_COLOR } from '../constants/colors';
import { radius } from '../constants/radius';

// ─── Constants ───────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  PALETTE.pink, PALETTE.red, PALETTE.orange, PALETTE.yellow,
  PALETTE.green, PALETTE.teal, PALETTE.blue, PALETTE.purple, PALETTE.white,
] as const;

// ─── ProfileEditScreen ────────────────────────────────────────────────────────

export default function ProfileEditScreen({ navigation }: ProfileEditScreenProps) {
  const { profile, setProfile } = useAppStore();
  const { save } = useSupabaseProfile();
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const contentWidth = Math.max(0, windowW - 56);
  const ctaContainerH = CTA_AREA_HEIGHT;
  const ctaHeight = 58;

  const nameRef = useRef<TextInput | null>(null);
  const numberRef = useRef<TextInput | null>(null);

  const {
    displayName, raceNumber, teamColor, setTeamColor,
    trimmedName, normalizedNumber, canSubmit,
    nameError, numberError,
    nameShakeX, numberShakeX, nameFocusSpread, numberFocusSpread,
    onChangeName, onChangeNumber,
    onFocusName, onBlurName, onFocusNumber, onBlurNumber,
  } = useProfileValidation({
    initialName: profile.displayName,
    initialNumber: profile.raceNumber,
    initialColor: profile.nameTagAccentColor ?? null,
    requireColor: false,
  });

  const previewCode = useMemo(() => getDriverCode(displayName), [displayName]);
  const previewNumber = normalizedNumber || '00';
  const previewColor = teamColor ?? PREVIEW_DEFAULT_COLOR;


  return (
    <View style={[styles.root, { paddingBottom: ctaContainerH }]}>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop + 63 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Edit Profile</Text>

        <View style={styles.formWrap}>
          {/* Name */}
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
                keyboardType="ascii-capable"
                returnKeyType="next"
                selectionColor={PALETTE.white}
                placeholder=""
                style={[styles.inputText, styles.inputNoOutline]}
              />
              <Animated.View
                style={[
                  styles.inputUnderlineTrack,
                  { transform: [{ translateX: nameShakeX }] },
                  nameError ? styles.inputUnderlineError : null,
                ]}
              >
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

          {/* Racer Number */}
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
                selectionColor={PALETTE.white}
                placeholder=""
                style={[styles.inputText, styles.inputNoOutline]}
              />
              <Animated.View
                style={[
                  styles.inputUnderlineTrack,
                  { transform: [{ translateX: numberShakeX }] },
                  numberError ? styles.inputUnderlineError : null,
                ]}
              >
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

          {/* Team Color */}
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
                      selected ? styles.colorSwatchSelected : null,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Preview nametag */}
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Preview</Text>
            <GradientCardBorder style={[styles.previewBoxOuter, { width: contentWidth }]} innerStyle={styles.previewBoxInner} borderRadius={radius.sm.borderRadius}>
              <View style={styles.previewRow}>
                <View style={[styles.previewAccent, { backgroundColor: previewColor }]} />
                <Text style={styles.previewName}>{previewCode}</Text>
              </View>
              <Text style={styles.previewNumber}>#{previewNumber}</Text>
            </GradientCardBorder>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <CtaFadeBackground height={ctaContainerH} style={{ paddingBottom: safeBottom + 16, justifyContent: 'flex-end', alignItems: 'center' }}>
        <GradientCtaButton
          height={ctaHeight}
          label="Confirm"
          enabled={canSubmit}
          onPress={() => {
            const finalColor = teamColor ?? PREVIEW_DEFAULT_COLOR;
            setProfile({
              displayName: trimmedName,
              raceNumber: normalizedNumber,
              nameTagAccentColor: finalColor,
            });
            save({
              display_name: trimmedName,
              race_number: normalizedNumber,
              accent_color: finalColor,
            }).catch(() => {});
            navigation.goBack();
          }}
        />
      </CtaFadeBackground>

      {/* BackButton — 다른 화면과 동일하게 절대위치, 마지막에 렌더해 최상단에 표시 */}
      <BackButton onPress={() => navigation.goBack()} />
      <TopSafeBlurOverlay safeTop={safeTop} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 36,
  },
  title: {
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    lineHeight: 43,
    letterSpacing: 36 * 0.05,
    color: PALETTE.white,
    includeFontPadding: false,
    marginLeft: 4,
  },
  formWrap: {
    gap: 48,
  },
  fieldBlock: {
    gap: 10,
  },
  fieldLabel: {
    color: COLORS.text.secondary,
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    includeFontPadding: false,
  },
  inputLineWrap: {
    gap: 4,
  },
  inputText: {
    color: PALETTE.white,
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
    ...({ outlineStyle: 'none', outlineWidth: 0 } as object),
  },
  inputUnderlineTrack: {
    width: '100%',
    height: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  inputUnderlineSpread: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PALETTE.white,
    transform: [{ scaleX: 0 }],
  },
  inputUnderlineError: {
    backgroundColor: PALETTE.red,
  },
  errorText: {
    color: PALETTE.red,
    fontFamily: 'Formula1-Regular',
    fontSize: 11,
    lineHeight: 14,
    marginTop: -2,
    marginBottom: 2,
  },
  teamSection: {
    gap: 18,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11.56,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 1,
  },
  colorSwatchDimmed: {
    opacity: 0.3,
  },
  colorSwatchSelected: {
    opacity: 1,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  previewSection: {
    gap: 12,
  },
  previewLabel: {
    color: COLORS.text.secondary,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 20 * -0.01,
    includeFontPadding: false,
  },
  previewBoxOuter: {
    ...radius.sm,
  },
  previewBoxInner: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  previewAccent: {
    width: 11.25,
    height: 37.5,
    borderRadius: 2,
  },
  previewName: {
    color: PALETTE.white,
    fontFamily: 'Formula1-Bold',
    fontSize: 24,
    lineHeight: 29,
    includeFontPadding: false,
  },
  previewNumber: {
    color: COLORS.text.secondary,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
});
