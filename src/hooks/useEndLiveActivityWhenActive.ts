import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { endAllLiveActivities } from '../platform/liveActivity';

/**
 * 결과 화면 마운트 시 Live Activity 종료 — 단, **AppState가 'active'일 때만**.
 *
 * 사용자 명세: "Well done, mate" LA는
 *   - 사용자가 LA를 탭해서 들어왔거나 (탭 → deep link → 앱 active)
 *   - 결과 화면을 실제로 보았을 때 (foreground active)
 * 에만 종료되어야 함.
 *
 * 백그라운드에서 자동완주된 케이스에서는 결과 화면이 백그라운드에서 mount되므로
 * 즉시 종료하면 잠금화면 LA가 한 번도 노출되지 않음.
 *
 * 동작:
 *   - 마운트 시점에 'active'면 즉시 endAll
 *   - 그렇지 않으면 AppState 'active' 전환 listener 등록 → 한 번만 endAll
 *   - cleanup에서 listener 제거 (이미 ended 되었으면 no-op)
 */
export function useEndLiveActivityWhenActive() {
  const endedRef = useRef(false);

  useEffect(() => {
    const end = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      endAllLiveActivities().catch(() => {});
    };

    if (AppState.currentState === 'active') {
      end();
      return;
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') end();
    });
    return () => sub.remove();
  }, []);
}
