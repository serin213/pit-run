/**
 * 모든 pending mutation queue를 flush — 세션 / 퀄리파잉 / 프로필.
 *
 * Offline-first 전략의 핵심:
 *   - 로컬 MMKV에 즉시 보관 (useSupabase*.save가 실패 분기에서 enqueue)
 *   - 이 함수가 네트워크 회복 시점에 호출되어 일괄 업로드 시도
 *   - 트리거: 앱 launch (useSyncOnLogin), AppState 'active' 전환 (usePendingFlushTriggers)
 *
 * 멱등성 (idempotency):
 *   - 동시 호출 방지를 위해 module-level mutex로 직렬화
 *   - 각 큐 항목은 started_at / queuedAt 기반 중복 방지
 *   - 모든 작업은 try-catch — 한 항목 실패해도 다음 항목 계속 처리
 */

import { insertCompletedSession } from './sessions';
import { insertQualifying } from './qualifying';
import { upsertProfile } from './profiles';
import { recordActivityToday } from './activity';
import { getPendingQueue, removePendingSession } from './pendingSessions';
import {
  getPendingQualifyingQueue,
  removePendingQualifying,
  getPendingProfile,
  clearPendingProfile,
} from './pendingMutations';

let _flushInFlight = false;

/**
 * 모든 pending mutation을 순서대로 flush.
 *
 * @returns 처리 결과 요약 (디버깅 용도)
 */
export async function flushAllPendingMutations(): Promise<{
  sessions: { attempted: number; succeeded: number };
  qualifying: { attempted: number; succeeded: number };
  profile: { attempted: number; succeeded: boolean };
}> {
  // 동시 호출 방지 — 짧은 시간 동안 여러 트리거가 겹쳐도 한 번만 실행.
  // 두 번째 호출은 첫 번째가 끝날 때까지 기다리지 않고 즉시 빈 결과 반환.
  if (_flushInFlight) {
    return {
      sessions: { attempted: 0, succeeded: 0 },
      qualifying: { attempted: 0, succeeded: 0 },
      profile: { attempted: 0, succeeded: false },
    };
  }
  _flushInFlight = true;

  const result = {
    sessions: { attempted: 0, succeeded: 0 },
    qualifying: { attempted: 0, succeeded: 0 },
    profile: { attempted: 0, succeeded: false },
  };

  try {
    // 1. Sessions queue
    const sessionQueue = getPendingQueue();
    result.sessions.attempted = sessionQueue.length;
    for (const pending of sessionQueue) {
      const { _queuedAt, ...fields } = pending;
      try {
        await insertCompletedSession(fields);
        removePendingSession(_queuedAt);
        recordActivityToday().catch(() => {});
        result.sessions.succeeded++;
      } catch (e) {
        console.warn(`[pendingFlush/session] retry failed for ${fields.started_at}:`, e);
      }
    }

    // 2. Qualifying queue
    const qualQueue = getPendingQualifyingQueue();
    result.qualifying.attempted = qualQueue.length;
    for (const pending of qualQueue) {
      const { _queuedAt, ...fields } = pending;
      try {
        await insertQualifying(fields);
        removePendingQualifying(_queuedAt);
        result.qualifying.succeeded++;
      } catch (e) {
        console.warn('[pendingFlush/qualifying] retry failed:', e);
      }
    }

    // 3. Profile slot
    const pendingProf = getPendingProfile();
    if (pendingProf) {
      result.profile.attempted = 1;
      try {
        await upsertProfile(pendingProf);
        clearPendingProfile();
        result.profile.succeeded = true;
      } catch (e) {
        console.warn('[pendingFlush/profile] retry failed:', e);
      }
    }

    const total =
      result.sessions.succeeded + result.qualifying.succeeded + (result.profile.succeeded ? 1 : 0);
    const attempted =
      result.sessions.attempted + result.qualifying.attempted + result.profile.attempted;
    if (attempted > 0) {
      console.warn(`[pendingFlush] ${total}/${attempted} flushed`);
    }
  } finally {
    _flushInFlight = false;
  }

  return result;
}
