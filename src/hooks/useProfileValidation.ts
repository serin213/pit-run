import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

const NAME_MAX_LEN = 20;
const RACER_NUMBER_MAX_LEN = 5;

function toDriverNameCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function shakeAnimation(target: Animated.Value): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(target, { toValue: -6, duration: 45, useNativeDriver: true }),
    Animated.timing(target, { toValue:  6, duration: 45, useNativeDriver: true }),
    Animated.timing(target, { toValue: -4, duration: 40, useNativeDriver: true }),
    Animated.timing(target, { toValue:  4, duration: 40, useNativeDriver: true }),
    Animated.timing(target, { toValue:  0, duration: 35, useNativeDriver: true }),
  ]);
}

interface Options {
  initialName?: string;
  initialNumber?: string;
  initialColor?: string | null;
  requireColor?: boolean;
}

export interface ProfileValidation {
  displayName: string;
  raceNumber: string;
  teamColor: string | null;
  setTeamColor: (color: string | null) => void;
  trimmedName: string;
  normalizedNumber: string;
  isNameValid: boolean;
  isNumberValid: boolean;
  canSubmit: boolean;
  nameError: string;
  numberError: string;
  nameShakeX: Animated.Value;
  numberShakeX: Animated.Value;
  nameFocusSpread: Animated.Value;
  numberFocusSpread: Animated.Value;
  onChangeName: (raw: string) => void;
  onChangeNumber: (raw: string) => void;
  onFocusName: () => void;
  onBlurName: () => void;
  onFocusNumber: () => void;
  onBlurNumber: () => void;
}

export function useProfileValidation({
  initialName = '',
  initialNumber = '',
  initialColor = null,
  requireColor = false,
}: Options = {}): ProfileValidation {
  const [displayName, setDisplayName] = useState(initialName);
  const [raceNumber, setRaceNumber] = useState(initialNumber);
  const [teamColor, setTeamColor] = useState<string | null>(initialColor);
  const [nameBlurredOnce, setNameBlurredOnce] = useState(false);
  const [nameFlashError, setNameFlashError] = useState('');
  const [numberFlashError, setNumberFlashError] = useState('');

  const nameErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numberErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameShakeX = useRef(new Animated.Value(0)).current;
  const numberShakeX = useRef(new Animated.Value(0)).current;
  const nameFocusSpread = useRef(new Animated.Value(0)).current;
  const numberFocusSpread = useRef(new Animated.Value(0)).current;

  useEffect(() => () => {
    if (nameErrorTimerRef.current) clearTimeout(nameErrorTimerRef.current);
    if (numberErrorTimerRef.current) clearTimeout(numberErrorTimerRef.current);
  }, []);

  const trimmedName = useMemo(() => displayName.trim(), [displayName]);
  const nameLetterCount = useMemo(() => trimmedName.replace(/\s+/g, '').length, [trimmedName]);
  const normalizedNumber = useMemo(() => raceNumber.trim(), [raceNumber]);

  const isNameValid = nameLetterCount >= 3 && trimmedName.length > 0;
  const isNumberValid = normalizedNumber.length >= 1;
  const isColorValid = !!teamColor;
  const canSubmit = isNameValid && isNumberValid && (!requireColor || isColorValid);

  const nameError = useMemo(() => {
    if (nameBlurredOnce && trimmedName.length > 0 && nameLetterCount < 3) return 'Use at least 3 English letters.';
    if (nameFlashError) return nameFlashError;
    return '';
  }, [nameBlurredOnce, nameFlashError, nameLetterCount, trimmedName.length]);

  const numberError = useMemo(() => numberFlashError, [numberFlashError]);

  const showNameFlashError = (message: string) => {
    if (nameErrorTimerRef.current) clearTimeout(nameErrorTimerRef.current);
    setNameFlashError(message);
    shakeAnimation(nameShakeX).start();
    nameErrorTimerRef.current = setTimeout(() => {
      setNameFlashError('');
      nameErrorTimerRef.current = null;
    }, 1200);
  };

  const showNumberFlashError = (message: string) => {
    if (numberErrorTimerRef.current) clearTimeout(numberErrorTimerRef.current);
    setNumberFlashError(message);
    shakeAnimation(numberShakeX).start();
    numberErrorTimerRef.current = setTimeout(() => {
      setNumberFlashError('');
      numberErrorTimerRef.current = null;
    }, 1200);
  };

  const animateUnderline = (target: Animated.Value, focused: boolean) => {
    Animated.timing(target, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const onChangeName = (raw: string) => {
    const removedLeading = raw.replace(/^\s+/, '');
    const hasInvalid = /[^A-Za-z\s]/.test(removedLeading);
    const englishOnly = removedLeading.replace(/[^A-Za-z\s]/g, '');
    const overLimit = englishOnly.length > NAME_MAX_LEN || removedLeading.length > NAME_MAX_LEN;
    const truncated = englishOnly.slice(0, NAME_MAX_LEN);
    setDisplayName(toDriverNameCase(truncated));
    if (hasInvalid) showNameFlashError('Use English letters and spaces only.');
    if (overLimit) showNameFlashError('Use up to 20 characters.');
  };

  const onChangeNumber = (raw: string) => {
    const noWhitespace = raw.replace(/\s+/g, '');
    const hasInvalid = /[^0-9]/.test(noWhitespace);
    const digitsOnly = noWhitespace.replace(/[^0-9]/g, '');
    const overLimit = digitsOnly.length > RACER_NUMBER_MAX_LEN || noWhitespace.length > RACER_NUMBER_MAX_LEN;
    setRaceNumber(digitsOnly.slice(0, RACER_NUMBER_MAX_LEN));
    if (hasInvalid) showNumberFlashError('Use digits only.');
    if (overLimit) showNumberFlashError('Use up to 5 digits.');
  };

  const onFocusName = () => animateUnderline(nameFocusSpread, true);

  const onBlurName = () => {
    animateUnderline(nameFocusSpread, false);
    setNameBlurredOnce(true);
    setDisplayName((prev) => prev.replace(/\s+$/, ''));
    if (trimmedName.length > 0 && nameLetterCount < 3) {
      shakeAnimation(nameShakeX).start();
    }
  };

  const onFocusNumber = () => animateUnderline(numberFocusSpread, true);

  const onBlurNumber = () => {
    animateUnderline(numberFocusSpread, false);
    setRaceNumber((prev) => prev.replace(/\s+$/, ''));
  };

  return {
    displayName, raceNumber, teamColor, setTeamColor,
    trimmedName, normalizedNumber,
    isNameValid, isNumberValid, canSubmit,
    nameError, numberError,
    nameShakeX, numberShakeX, nameFocusSpread, numberFocusSpread,
    onChangeName, onChangeNumber,
    onFocusName, onBlurName, onFocusNumber, onBlurNumber,
  };
}
