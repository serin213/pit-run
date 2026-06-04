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

import { insertCompletedSession, fetchSessions } from './sessions';
import { insertQualifying, fetchQualifyingHistory } from './qualifying';
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
    // ── 1. Sessions queue ─────────────────────────────────────────────────
    const sessionQueue = getPendingQueue();
    result.sessions.attempted = sessionQueue.length;
    if (sessionQueue.length > 0) {
      // 중복 INSERT 방지 — 큐 항목 중 DB에 이미 존재하는 id 또는 started_at은
      // skip하고 큐에서 제거. id 매칭이 우선 (race의 경우 raceId 기반 idempotent).
      let dbIds = new Set<string>();
      let dbStartedAt = new Set<string>();
      try {
        const recent = await fetchSessions(200);
        dbIds = new Set(recent.map((r) => r.id));
        dbStartedAt = new Set(recent.map((r) => r.started_at));
      } catch {
        // fetch 실패 시 dedup 없이 진행 — insertCompletedSession의 upsert가 보호
      }
      for (const pending of sessionQueue) {
        const { _queuedAt, ...fields } = pending;
        const idAlreadyInDb = !!fields.id && dbIds.has(fields.id);
        const startedAtAlreadyInDb = dbStartedAt.has(fields.started_at);
        if (idAlreadyInDb || startedAtAlreadyInDb) {
          removePendingSession(_queuedAt);
          if (__DEV__) {
            console.warn(`[pendingFlush/session] DB already has session, skipping`);
          }
          continue;
        }
        try {
          await insertCompletedSession(fields);
          removePendingSession(_queuedAt);
          recordActivityToday().catch(() => {});
          result.sessions.succeeded++;
        } catch (e) {
          console.warn(`[pendingFlush/session] retry failed for ${fields.started_at}:`, e);
        }
      }
    }

    // ── 2. Qualifying queue ───────────────────────────────────────────────
    const qualQueue = getPendingQualifyingQueue();
    result.qualifying.attempted = qualQueue.length;
    if (qualQueue.length > 0) {
      // 중복 INSERT 방지. qualifying_results는 client-side recorded_at이 없어 시간
      // 정확 비교 불가 → grade + one_km_ms + pace_sec_per_km 동치로 매칭.
      // 같은 사용자가 같은 분 내에 같은 결과로 두 번 qualifying 할 가능성은 거의 없음.
      let recentQual: Array<{ one_km_ms: number; pace_sec_per_km: number; grade: string }> = [];
      try {
        recentQual = await fetchQualifyingHistory();
      } catch {
        // ignore
      }
      for (const pending of qualQueue) {
        const { _queuedAt, ...fields } = pending;
        const dup = recentQual.some(
          (r) =>
            r.one_km_ms === fields.one_km_ms &&
            Math.abs(Number(r.pace_sec_per_km) - fields.pace_sec_per_km) < 0.01 &&
            r.grade === fields.grade,
        );
        if (dup) {
          removePendingQualifying(_queuedAt);
          if (__DEV__) {
            console.warn(`[pendingFlush/qualifying] DB has matching result, skipping`);
          }
          continue;
        }
        try {
          await insertQualifying(fields);
          removePendingQualifying(_queuedAt);
          result.qualifying.succeeded++;
        } catch (e) {
          console.warn('[pendingFlush/qualifying] retry failed:', e);
        }
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
