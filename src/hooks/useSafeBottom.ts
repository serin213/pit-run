import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iPhone home indicator reference fallback for simulator / edge cases.
const FALLBACK_HOME_H = 34;

export function useSafeBottom(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom > 0 ? insets.bottom : FALLBACK_HOME_H;
}
