import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Matches SafeAreaOverlay's DEFAULT_STATUS_H fallback.
// When insets.top is 0 (simulator / edge case), use 59 so our spacer
// matches the fake status bar that SafeAreaOverlay draws.
const FALLBACK_STATUS_H = 59;

export function useSafeTop(): number {
  const insets = useSafeAreaInsets();
  return insets.top > 0 ? insets.top : FALLBACK_STATUS_H;
}
