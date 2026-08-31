import { useSafeAreaInsets } from 'react-native-safe-area-context';

// When insets.top is 0 (simulator / edge case), use the iPhone 16 Pro
// reference status height so screen spacing remains stable.
const FALLBACK_STATUS_H = 59;

export function useSafeTop(): number {
  const insets = useSafeAreaInsets();
  const raw = insets.top > 0 ? insets.top : FALLBACK_STATUS_H;
  return Math.round((raw * 2) / 3);
}
