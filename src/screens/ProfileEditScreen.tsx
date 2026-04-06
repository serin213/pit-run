import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import Svg, { Defs, LinearGradient as SvgLG, Path, Rect, Stop } from 'react-native-svg';
import GradientCtaButton from '../components/GradientCtaButton';
import BackButton from '../components/BackButton';
import { getDriverCode } from '../utils/driverCode';
import { useAppStore } from '../store/appStore';
import { useSafeTop } from '../hooks/useSafeTop';
import { useSafeBottom } from '../hooks/useSafeBottom';
import type { ProfileEditScreenProps } from '../navigation/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  '#E03A8A', '#E03A3E', '#FF8716', '#FCB827',
  '#59B345', '#04CBBA', '#3F5CFF', '#8528C5', '#FFFFFF',
] as const;
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

// ─── ProfileEditScreen ────────────────────────────────────────────────────────

export default function ProfileEditScreen({ navigation }: ProfileEditScreenProps) {
  const { profile, setProfile } = useAppStore();
  const { width: windowW } = useWindowDimensions();
  const safeTop = useSafeTop();
  const safeBottom = useSafeBottom();

  const contentWidth = Math.max(0, windowW - 56);
  const ctaContainerH = 164;
  const ctaHeight = 58;

  const nameRef = useRef<TextInput | null>(null);
  const numberRef = useRef<TextInput | null>(null);

  // Pre-populate from current profile
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [raceNumber, setRaceNumber] = useState(profile.raceNumber);
  const [teamColor, setTeamColor] = useState<string | null>(profile.nameTagAccentColor ?? null);
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
  const canSubmit = isNameValid && isNumberValid;

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
    animateUnderlineSpread(nameFocusSpread, true);
  };

  const onBlurName = () => {
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
    animateUnderlineSpread(numberFocusSpread, true);
  };

  const onBlurNumber = () => {
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
    <View style={[s.root, { paddingBottom: ctaContainerH }]}>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, { paddingTop: safeTop + 63 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={s.title}>Edit Profile</Text>

        <View style={s.formWrap}>
          {/* Name */}
          <View style={s.fieldBlock}>
            <Text style={s.fieldLabel}>Name</Text>
            <View style={s.inputLineWrap}>
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
                keyboardType="ascii-capable"
                returnKeyType="next"
                selectionColor="#FFFFFF"
                placeholder=""
                style={[s.inputText, s.inputNoOutline]}
              />
              <Animated.View
                style={[
                  s.inputUnderlineTrack,
                  { transform: [{ translateX: nameShakeX }] },
                  nameError ? s.inputUnderlineError : null,
                ]}
              >
                <Animated.View
                  style={[
                    s.inputUnderlineSpread,
                    {
                      transform: [{ scaleX: nameFocusSpread }],
                      opacity: nameError ? 0 : nameFocusSpread,
                    },
                  ]}
                />
              </Animated.View>
            </View>
            {!!nameError && <Text style={s.errorText}>{nameError}</Text>}
          </View>

          {/* Racer Number */}
          <View style={s.fieldBlock}>
            <Text style={s.fieldLabel}>Racer Number</Text>
            <View style={s.inputLineWrap}>
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
                style={[s.inputText, s.inputNoOutline]}
              />
              <Animated.View
                style={[
                  s.inputUnderlineTrack,
                  { transform: [{ translateX: numberShakeX }] },
                  numberError ? s.inputUnderlineError : null,
                ]}
              >
                <Animated.View
                  style={[
                    s.inputUnderlineSpread,
                    {
                      transform: [{ scaleX: numberFocusSpread }],
                      opacity: numberError ? 0 : numberFocusSpread,
                    },
                  ]}
                />
              </Animated.View>
            </View>
            {!!numberError && <Text style={s.errorText}>{numberError}</Text>}
          </View>

          {/* Team Color */}
          <View style={s.teamSection}>
            <Text style={s.fieldLabel}>Team Color</Text>
            <View style={s.colorRow}>
              {TEAM_COLORS.map((color) => {
                const selected = color === teamColor;
                return (
                  <Pressable
                    key={color}
                    onPress={() => setTeamColor((prev) => (prev === color ? null : color))}
                    style={[
                      s.colorSwatch,
                      { backgroundColor: color },
                      teamColor && !selected ? s.colorSwatchDimmed : null,
                      selected ? s.colorSwatchSelected : null,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Preview nametag */}
          <View style={s.previewSection}>
            <Text style={s.previewLabel}>Preview</Text>
            <View style={[s.previewBox, { width: contentWidth }]}>
              <View style={s.previewRow}>
                <View style={[s.previewAccent, { backgroundColor: previewColor }]} />
                <Text style={s.previewName}>{previewCode}</Text>
              </View>
              <Text style={s.previewNumber}>#{previewNumber}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[s.ctaContainer, { height: ctaContainerH, paddingBottom: safeBottom + 16 }]}
        pointerEvents="box-none"
      >
        <Svg
          width={windowW}
          height={ctaContainerH}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLG id="editFade" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="66%" stopColor="#17171C" stopOpacity="1" />
              <Stop offset="100%" stopColor="#17171C" stopOpacity="0" />
            </SvgLG>
          </Defs>
          <Rect x={0} y={0} width={windowW} height={ctaContainerH} fill="url(#editFade)" />
        </Svg>
        <GradientCtaButton
          width={contentWidth}
          height={ctaHeight}
          label="Confirm"
          enabled={canSubmit}
          onPress={() => {
            setProfile({
              displayName: toDriverNameCase(trimmedName),
              raceNumber: normalizedNumber,
              nameTagAccentColor: teamColor ?? PREVIEW_DEFAULT_COLOR,
            });
            navigation.goBack();
          }}
        />
      </View>

      {/* BackButton — 다른 화면과 동일하게 절대위치, 마지막에 렌더해 최상단에 표시 */}
      <BackButton onPress={() => navigation.goBack()} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    gap: 36,
  },
  title: {
    fontFamily: 'Formula1-Black',
    fontSize: 36,
    lineHeight: 43,
    letterSpacing: 36 * 0.05,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  formWrap: {
    gap: 48,
  },
  fieldBlock: {
    gap: 10,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 17,
    lineHeight: 20,
    includeFontPadding: false,
  },
  inputLineWrap: {
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
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Formula1-Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 20 * -0.01,
    includeFontPadding: false,
  },
  previewBox: {
    backgroundColor: '#202028',
    borderRadius: 16,
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
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 28,
    right: 28,
    justifyContent: 'flex-end',
  },
});
