import { useCallback, useRef, useState } from 'react';
import {
  insertSession,
  completeSession,
  deleteSession,
  insertCompletedSession,
  type SessionRow,
  type SessionType,
  type SessionStatus,
} from '../api/sessions';
import { enqueuePendingSession } from '../api/pendingSessions';
import { recordActivityToday } from '../api/activity';
import { useAuthStore } from '../store/authStore';
import { invalidateSessionsCache } from '../api/historyCache';

/**
 * 같은 raceId (client-generated UUID)로 직전 30초 안에 저장 시도한 항목.
 * autoSavedRef per-component-instance라 ResultScreen이 re-mount되면 reset되지만
 * 이 module-level Set은 process 살아있는 동안 유지되어 같은 raceId 중복 차단.
 * 30초 후 자동 제거 — process 죽으면 어차피 사라지므로 메모리 누수 아님.
 */
const recentlySavedIds = new Set<string>();

/**
 * 러닝 세션을 Supabase에 기록하는 훅.
 * 세션 시작 → 완료/포기 흐름을 관리.
 *
 * - startSession: 'started' 상태 행 생성 (activity_dates 업데이트 X)
 * - endSession: 'completed' 상태로 업데이트 + activity_dates 갱신
 * - discardSession: 행 자체를 DELETE — 안 뛴 걸로 취급. activity_dates 갱신 안 함.
 */
export function useSupabaseSession() {
  const { isAuthenticated } = useAuthStore();
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const startSession = useCallback(
    async (type: SessionType, circuitId?: string | null) => {
      if (!isAuthenticated) return null;
      try {
        const row = await insertSession({ type, circuit_id: circuitId });
        setActiveSession(row);
        sessionIdRef.current = row.id;
        return row;
      } catch (e) {
        console.warn('[useSupabaseSession] start error:', e);
        return null;
      }
    },
    [isAuthenticated],
  );

  const endSession = useCallback(
    async (fields: {
      status: SessionStatus;
      total_dist_km: number;
      total_time_ms: number;
      avg_pace_sec_per_km?: number | null;
      best_pace_sec_per_km?: number | null;
      payload?: Record<string, unknown>;
    }) => {
      const id = sessionIdRef.current;
      if (!isAuthenticated || !id) return null;
      try {
        const row = await completeSession(id, fields);
        setActiveSession(null);
        sessionIdRef.current = null;
        // 완주 시점에만 activity_dates 기록 (조기 종료/discard는 미기록)
        recordActivityToday().catch(() => {});
        return row;
      } catch (e) {
        console.warn('[useSupabaseSession] end error:', e);
        return null;
      }
    },
    [isAuthenticated],
  );

  /** 세션 행을 DB에서 삭제. 안 뛴 걸로 취급 — history에서 즉시 사라짐. */
  const discardSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!isAuthenticated || !id) return;
    try {
      await deleteSession(id);
    } catch (e) {
      console.warn('[useSupabaseSession] discard error:', e);
    } finally {
      setActiveSession(null);
      sessionIdRef.current = null;
    }
  }, [isAuthenticated]);

  /**
   * 완주 확정 시점에 행을 직접 INSERT.
   * startSession/endSession 페어를 쓰지 않으므로 retire/중단 케이스에서
   * DB에 'started' 잔재가 절대 안 남음. 'completed' + activity_dates 갱신까지 처리.
   *
   * 저장 실패 처리:
   *   - !isAuthenticated이라도 pending queue에 무조건 적재 (다음 launch flush에서 처리).
   *     v1은 `if (!isAuthenticated) return null`로 silent drop → 백그라운드에서
   *     세션 refresh 실패 시점에 race 종료하면 데이터 영구 유실됨.
   *   - withRetry 3회 후에도 실패하면 동일하게 MMKV pending queue에 적재.
   *   - usePendingSessionFlush 훅이 다음 앱 시작 시 자동 재시도.
   */
  const saveCompletedSession = useCallback(
    async (fields: {
      /**
       * 클라이언트 생성 UUID — runStore.raceId 또는 호출부에서 결정.
       * 전달되면 API 레이어에서 upsert(onConflict: 'id')로 처리 → 같은 race가
       * 중복 호출되어도 DB row 1개만 유지 (re-mount / 네트워크 retry 모두 차단).
       */
      id?: string;
      type: SessionType;
      circuit_id?: string | null;
      started_at: string;
      total_dist_km: number;
      total_time_ms: number;
      avg_pace_sec_per_km?: number | null;
      best_pace_sec_per_km?: number | null;
      payload?: Record<string, unknown>;
    }) => {
      // In-memory dedup: 짧은 시간 안에 같은 id로 중복 호출되면 skip.
      // useEffect 재발화 / Component re-mount 케이스 방어 (process 살아있는 동안).
      if (fields.id && recentlySavedIds.has(fields.id)) {
        return null;
      }
      // 인증되지 않은 상태에서도 절대 drop하지 않음 — pending queue로.
      // 백그라운드 자동완주 직후 supabase session refresh가 일시적으로 실패해
      // isAuthenticated이 false인 케이스를 방어. 다음 launch에서 인증되면 flush됨.
      if (!isAuthenticated) {
        console.warn('[useSupabaseSession] not authenticated, queuing session for next launch');
        enqueuePendingSession(fields);
        return null;
      }
      if (fields.id) {
        recentlySavedIds.add(fields.id);
        // 30초 후 cleanup — process 살아있는 동안만 의미 있음
        setTimeout(() => recentlySavedIds.delete(fields.id!), 30_000);
      }
      try {
        const row = await insertCompletedSession(fields);
        recordActivityToday().catch(() => {});
        // History 캐시 무효화 — 다음 useFocusEffect에서 새 row 즉시 표시.
        // 무효화 없으면 30s TTL 동안 stale 캐시가 노출되어 방금 저장한 race가
        // History에 안 보임 (stale-while-revalidate가 갱신하긴 하지만 한 frame 지연).
        invalidateSessionsCache();
        return row;
      } catch (e) {
        console.warn('[useSupabaseSession] saveCompleted failed, queuing for retry:', e);
        // 3회 재시도 후에도 실패 → MMKV에 보관, 다음 앱 시작 시 flush
        enqueuePendingSession(fields);
        return null;
      }
    },
    [isAuthenticated],
  );

  return { activeSession, startSession, endSession, discardSession, saveCompletedSession };
}
