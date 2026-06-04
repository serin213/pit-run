import { useCallback, useState } from 'react';
import { fetchSessions, type SessionRow } from '../api/sessions';
import { getPendingQueue } from '../api/pendingSessions';
import { useAuthStore } from '../store/authStore';
import {
  HISTORY_FETCH_TTL_MS,
  getSessionsCache,
  setSessionsCache,
} from '../api/historyCache';

/**
 * 세션 히스토리 조회 훅.
 *
 * 캐시 전략 (모듈 캐시는 src/api/historyCache.ts에서 관리):
 *   - HistoryScreen이 mount될 때마다 빈 배열로 시작하면 "달력은 즉시, 카드만 늦게"
 *     보이는 깜빡임 발생.
 *   - useState 초기값에서 캐시 부트스트랩 → 첫 paint에 이미 카드 데이터 들어있음.
 *   - userId가 다르면 cache miss → 계정 전환 안전.
 *   - Stale-while-revalidate: 캐시 즉시 표시 + 백그라운드 fetch.
 *   - 저장 / pendingFlush 성공 시 invalidateSessionsCache()로 강제 새로고침.
 *
 * 오프라인-우선 표시 보장:
 *   - DB fetch + pending queue 행 합쳐서 반환.
 *   - started_at으로 dedup (DB 우선).
 */
export function useSessionHistory() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  const [sessions, setSessions] = useState<SessionRow[]>(() => {
    const pending = pendingQueueAsRows();
    const cache = getSessionsCache();
    if (cache && userId && cache.userId === userId) {
      return mergeWithPending(cache.data, pending);
    }
    return pending;
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (limit = 100, options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const pendingRows = pendingQueueAsRows();
      const cache = getSessionsCache();

      // 캐시 fresh — TTL 안이고 force 아니면 네트워크 생략.
      if (!force && cache && userId && cache.userId === userId) {
        const age = Date.now() - cache.fetchedAt;
        if (age < HISTORY_FETCH_TTL_MS) {
          const merged = mergeWithPending(cache.data, pendingRows);
          setSessions(merged);
          return merged;
        }
      }

      if (!isAuthenticated || !userId) {
        setSessions(pendingRows);
        return pendingRows;
      }

      // Stale-while-revalidate: stale cache가 있으면 즉시 표시하고 fetch 진행.
      if (!force && cache && cache.userId === userId) {
        setSessions(mergeWithPending(cache.data, pendingRows));
      }

      try {
        setLoading(true);
        const rows = await fetchSessions(limit);
        setSessionsCache(userId, rows);
        const merged = mergeWithPending(rows, pendingRows);
        setSessions(merged);
        return merged;
      } catch (e) {
        console.warn('[useSessionHistory] fetch error:', e);
        const fallback = cache && cache.userId === userId
          ? mergeWithPending(cache.data, pendingRows)
          : pendingRows;
        setSessions(fallback);
        return fallback;
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, userId],
  );

  return { sessions, loading, load };
}

/** Pending session queue → 가상 SessionRow[]. */
function pendingQueueAsRows(): SessionRow[] {
  const pending = getPendingQueue();
  return pending.map((p) => ({
    id: `pending-${p._queuedAt}`,
    user_id: 'pending',
    type: p.type,
    circuit_id: p.circuit_id ?? null,
    started_at: p.started_at,
    ended_at: null,
    status: 'completed' as const,
    total_dist_km: p.total_dist_km,
    total_time_ms: p.total_time_ms,
    avg_pace_sec_per_km: p.avg_pace_sec_per_km ?? null,
    best_pace_sec_per_km: p.best_pace_sec_per_km ?? null,
    payload: p.payload ?? {},
    created_at: p._queuedAt,
  }));
}

/** DB 행 + pending 행 합치고 started_at 중복 제거 (DB 우선). */
function mergeWithPending(dbRows: SessionRow[], pendingRows: SessionRow[]): SessionRow[] {
  if (pendingRows.length === 0) return dbRows;
  const dbStartedAt = new Set(dbRows.map((r) => r.started_at));
  const uniquePending = pendingRows.filter((p) => !dbStartedAt.has(p.started_at));
  return [...dbRows, ...uniquePending].sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  );
}
