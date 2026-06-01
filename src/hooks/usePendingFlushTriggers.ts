import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { flushAllPendingMutations } from '../api/pendingFlush';

/**
 * Pending mutation queue를 자동으로 flush하는 트리거 hook.
 *
 * 발화 시점:
 *   1. AppState 'active' 전환 (백그라운드 → 포그라운드, 잠금 해제 등)
 *      - 보통 네트워크가 회복된 직후. 사용자 활동 재개 시점이라 push 적기.
 *   2. (useSyncOnLogin이 별도로 launch 시점 호출 — 중복 방어는 flushAllPendingMutations
 *      내부 mutex로 처리)
 *
 * 미설치 의존성으로 인해 NetInfo 기반 정확한 "네트워크 회복" 이벤트는 미사용.
 * 대신 AppState 'active' 가 실용적 근사치 — iOS/Android 모두에서 잠금 해제 / 앱 전환 시
 * 발화하고, 이 시점에 보통 네트워크 상태가 갱신되어 있음.
 *
 * 인증되지 않은 상태에선 flush 시도 안 함 (insertCompletedSession 등이 어차피 throw).
 */
export function usePendingFlushTriggers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        flushAllPendingMutations().catch(() => {});
      }
    });

    return () => sub.remove();
  }, [isAuthenticated]);
}
