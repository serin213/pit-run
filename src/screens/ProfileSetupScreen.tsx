import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { getDriverCode } from '../utils/driverCode';
import { radius } from '../constants/radius';
import GradientCtaButton from '../components/GradientCtaButton';
import CtaFadeBackground, { CTA_AREA_HEIGHT } from '../components/CtaFadeBackground';
import GradientCardBorder from '../components/GradientCardBorder';
import { useAppStore } from '../store/appStore';
import { useSupabaseProfile } from '../hooks/useSupabaseProfile';
import { getCurrentUser } from '../platform/auth';
import { logOnboardingCompleted } from '../lib/analytics/raceEvents';
import type { ProfileSetupScreenProps } from '../navigation/types';
import { useProfileValidation } from '../hooks/useProfileValidation';
import { COLORS, PALETTE, PREVIEW_DEFAULT_COLOR } from '../constants/colors';

const TEAM_COLORS = [PALETTE.pink, PALETTE.red, PALETTE.orange, PALETTE.yellow, PALETTE.green, PALETTE.teal, PALETTE.blue, PALETTE.purple, PALETTE.white] as const;
const PREVIEW_CARD_H = 83; // previewSection(119) - label(24) - gap(12)

export default function ProfileSetupScreen({ navigation }: ProfileSetupScreenProps) {
  const { setProfile } = useAppStore();
  const { save } = useSupabaseProfile();
  const { width: windowW } = useWindowDimensions();
  const contentWidth = Math.max(0, windowW - 40);
  const ctaContainerH = CTA_AREA_HEIGHT;
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
              selectionColor={PALETTE.white}
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
              selectionColor={PALETTE.white}
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
          <GradientCardBorder
            style={[styles.previewCard, { width: contentWidth }]}
            innerStyle={styles.previewCardInner}
            borderRadius={radius.sm.borderRadius}
          >
            <View style={styles.previewRow}>
              <View style={[styles.previewAccent, { backgroundColor: previewColor }]} />
              <Text style={styles.previewName}>{previewCode}</Text>
            </View>
            <Text style={styles.previewNumber}>#{previewNumber}</Text>
          </GradientCardBorder>
        </View>
      </View>

      {/* Bottom CTA area — absolute overlay with fade gradient */}
      <CtaFadeBackground height={ctaContainerH}>
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
      </CtaFadeBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 100,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
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
    color: PALETTE.white,
    letterSpacing: -0.36,
    includeFontPadding: false,
    marginLeft: 4,
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
    color: COLORS.text.secondary,
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
    color: COLORS.text.secondary,
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
  previewCard: {
    height: PREVIEW_CARD_H,
  },
  previewCardInner: {
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
