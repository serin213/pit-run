/**
 * Pending session flush hook
 *
 * 앱 시작 시 인증 완료 후 MMKV pending queue를 확인해 실패했던 세션을 재시도.
 * RootNavigator에서 호출 — 인증 상태가 true로 전환될 때마다 실행.
 *
 * 동작:
 *   1. isAuthenticated가 true가 되면 실행
 *   2. pending queue 조회
 *   3. 각 세션을 insertCompletedSession으로 재시도 (withRetry 포함)
 *   4. 성공 → 큐에서 제거 + recordActivityToday
 *   5. 실패 → 큐에 유지 (다음 앱 시작 시 재시도)
 */

import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getPendingQueue, removePendingSession } from '../api/pendingSessions';
import { insertCompletedSession } from '../api/sessions';
import { recordActivityToday } from '../api/activity';

export function usePendingSessionFlush(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      const queue = getPendingQueue();
      if (queue.length === 0) return;

      console.warn(`[PendingFlush] ${queue.length} pending session(s) to retry`);

      for (const pending of queue) {
        const { _queuedAt, ...fields } = pending;
        try {
          await insertCompletedSession(fields);
          removePendingSession(_queuedAt);
          recordActivityToday().catch(() => {});
          console.warn(`[PendingFlush] ✓ Flushed session started_at=${fields.started_at}`);
        } catch (e) {
          // 이번 앱 세션에서도 실패 — 큐에 유지, 다음 시작 시 재시도
          console.warn(`[PendingFlush] ✗ Still failing (started_at=${fields.started_at}):`, e);
        }
      }
    })();
  // isAuthenticated가 false→true로 바뀔 때(로그인 직후)만 실행
  }, [isAuthenticated]);
}
