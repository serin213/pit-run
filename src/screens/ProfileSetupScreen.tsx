import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

import { getDriverCode } from '../utils/driverCode';
import GradientCtaButton from '../components/GradientCtaButton';
import { useAppStore } from '../store/appStore';
import type { ProfileSetupScreenProps } from '../navigation/types';

const TEAM_COLORS = ['#E03A8A', '#E03A3E', '#FF8716', '#FCB827', '#59B345', '#04CBBA', '#3F5CFF', '#8528C5', '#FFFFFF'] as const;
const NAME_MAX_LEN = 20;
const RACER_NUMBER_MAX_LEN = 5;
const PREVIEW_DEFAULT_COLOR = '#7C7C88';

function toDriverNameCase(value: string) {
  return value
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

export default function ProfileSetupScreen({ navigation }: ProfileSetupScreenProps) {
  const { profile: initialProfile, setProfile } = useAppStore();
  const { width: windowW } = useWindowDimensions();
  const contentWidth = Math.max(0, windowW - 56);
  const ctaContainerH = 164;
  const ctaHeight = 54;
  const nameRef = useRef<TextInput | null>(null);
  const numberRef = useRef<TextInput | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [raceNumber, setRaceNumber] = useState('');
  const [teamColor, setTeamColor] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'name' | 'number' | null>('name');
  const [nameBlurredOnce, setNameBlurredOnce] = useState(false);
  const [nameFlashError, setNameFlashError] = useState('');
  const [numberFlashError, setNumberFlashError] = useState('');
  const nameErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numberErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameShakeX = useRef(new Animated.Value(0)).current;
  const numberShakeX = useRef(new Animated.Value(0)).current;
  const nameFocusSpread = useRef(new Animated.Value(0)).current;
  const numberFocusSpread = useRef(new Animated.Value(0)).current;

  const trimmedName = useMemo(() => displayName.trim(), [displayName]);
  const nameLetterCount = useMemo(() => trimmedName.replace(/\s+/g, '').length, [trimmedName]);
  const normalizedNumber = useMemo(() => raceNumber.trim(), [raceNumber]);

  const isNameValid = nameLetterCount >= 3 && trimmedName.length > 0;
  const isNumberValid = normalizedNumber.length >= 1;
  const isColorValid = !!teamColor;
  const canSubmit = isNameValid && isNumberValid && isColorValid;

  const nameError = useMemo(() => {
    if (nameBlurredOnce && trimmedName.length > 0 && nameLetterCount < 3) return 'Use at least 3 English letters.';
    if (nameFlashError) return nameFlashError;
    return '';
  }, [nameBlurredOnce, nameFlashError, nameLetterCount, trimmedName.length]);

  const numberError = useMemo(() => {
    if (numberFlashError) return numberFlashError;
    return '';
  }, [numberFlashError]);

  const previewCode = useMemo(() => getDriverCode(displayName), [displayName]);
  const previewNumber = normalizedNumber || '00';
  const previewColor = teamColor ?? PREVIEW_DEFAULT_COLOR;

  const showNameFlashError = (message: string) => {
    if (nameErrorTimerRef.current) clearTimeout(nameErrorTimerRef.current);
    setNameFlashError(message);
    Animated.sequence([
      Animated.timing(nameShakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(nameShakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(nameShakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(nameShakeX, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(nameShakeX, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start();
    nameErrorTimerRef.current = setTimeout(() => {
      setNameFlashError('');
      nameErrorTimerRef.current = null;
    }, 1200);
  };

  const showNumberFlashError = (message: string) => {
    if (numberErrorTimerRef.current) clearTimeout(numberErrorTimerRef.current);
    setNumberFlashError(message);
    Animated.sequence([
      Animated.timing(numberShakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(numberShakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(numberShakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(numberShakeX, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(numberShakeX, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start();
    numberErrorTimerRef.current = setTimeout(() => {
      setNumberFlashError('');
      numberErrorTimerRef.current = null;
    }, 1200);
  };

  const onChangeName = (raw: string) => {
    const removedLeading = raw.replace(/^\s+/, '');
    const hasInvalid = /[^A-Za-z\s]/.test(removedLeading);
    const englishOnly = removedLeading.replace(/[^A-Za-z\s]/g, '');
    const overLimit = englishOnly.length > NAME_MAX_LEN || removedLeading.length > NAME_MAX_LEN;
    const truncated = englishOnly.slice(0, NAME_MAX_LEN);
    const formatted = toDriverNameCase(truncated);

    setDisplayName(formatted);
    if (hasInvalid) showNameFlashError('Use English letters and spaces only.');
    if (overLimit) showNameFlashError('Use up to 20 characters.');
  };

  const animateUnderlineSpread = (target: Animated.Value, focused: boolean) => {
    Animated.timing(target, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const onFocusName = () => {
    setFocusedField('name');
    animateUnderlineSpread(nameFocusSpread, true);
  };

  const onBlurName = () => {
    setFocusedField(null);
    animateUnderlineSpread(nameFocusSpread, false);
    setNameBlurredOnce(true);
    setDisplayName((prev) => prev.replace(/\s+$/, ''));
    if (trimmedName.length > 0 && nameLetterCount < 3) {
      Animated.sequence([
        Animated.timing(nameShakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
        Animated.timing(nameShakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
        Animated.timing(nameShakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
        Animated.timing(nameShakeX, { toValue: 4, duration: 40, useNativeDriver: true }),
        Animated.timing(nameShakeX, { toValue: 0, duration: 35, useNativeDriver: true }),
      ]).start();
    }
  };

  const onChangeNumber = (raw: string) => {
    const noWhitespace = raw.replace(/\s+/g, '');
    const hasInvalid = /[^0-9]/.test(noWhitespace);
    const digitsOnly = noWhitespace.replace(/[^0-9]/g, '');
    const overLimit = digitsOnly.length > RACER_NUMBER_MAX_LEN || noWhitespace.length > RACER_NUMBER_MAX_LEN;
    const truncated = digitsOnly.slice(0, RACER_NUMBER_MAX_LEN);

    setRaceNumber(truncated);
    if (hasInvalid) showNumberFlashError('Use digits only.');
    if (overLimit) showNumberFlashError('Use up to 5 digits.');
  };

  const onFocusNumber = () => {
    setFocusedField('number');
    animateUnderlineSpread(numberFocusSpread, true);
  };

  const onBlurNumber = () => {
    setFocusedField(null);
    animateUnderlineSpread(numberFocusSpread, false);
    setRaceNumber((prev) => prev.replace(/\s+$/, ''));
  };

  useEffect(
    () => () => {
      if (nameErrorTimerRef.current) clearTimeout(nameErrorTimerRef.current);
      if (numberErrorTimerRef.current) clearTimeout(numberErrorTimerRef.current);
    },
    [],
  );

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
                setNameBlurredOnce(true);
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
                  onPress={() => setTeamColor((prev) => (prev === color ? null : color))}
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
          <View style={styles.previewBox}>
            <View style={styles.previewRow}>
              <View style={[styles.previewAccent, { backgroundColor: previewColor }]} />
              <Text style={styles.previewName}>{previewCode}</Text>
            </View>
            <Text style={styles.previewNumber}>#{previewNumber}</Text>
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
                displayName: toDriverNameCase(trimmedName),
                raceNumber: normalizedNumber,
                nameTagAccentColor: teamColor ?? PREVIEW_DEFAULT_COLOR,
              });
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
    paddingHorizontal: 28,
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
    left: 28,
    right: 28,
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
    backgroundColor: '#E03A3E',
  },
  errorText: {
    color: '#E03A3E',
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
  previewBox: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#202028',
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
