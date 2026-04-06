import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Matches SafeAreaOverlay's DEFAULT_HOME_H fallback.
const FALLBACK_HOME_H = 34;

export function useSafeBottom(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom > 0 ? insets.bottom : FALLBACK_HOME_H;
}
