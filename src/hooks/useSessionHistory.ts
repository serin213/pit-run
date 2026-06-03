import { useCallback, useRef, useState } from 'react';
import { fetchSessions, type SessionRow } from '../api/sessions';
import { getPendingQueue } from '../api/pendingSessions';
import { useAuthStore } from '../store/authStore';

// 같은 데이터를 30초 안에 다시 요청하면 캐시된 결과 반환.
// HistoryScreen / HomeScreen이 useFocusEffect로 매 focus마다 fetch하는데,
// 짧은 시간 안에 여러 번 focus(탭 전환 등)할 때 불필요한 네트워크 round-trip 제거.
// 만료 후엔 background refresh 패턴 — stale 데이터 즉시 반환 + 새로 fetch.
const FETCH_TTL_MS = 30_000;

/**
 * 세션 히스토리 조회 훅.
 *
 * 오프라인-우선 표시 보장:
 *   - DB에서 fetch한 행 + pending queue에 적재된 행을 합쳐서 반환.
 *   - pending 행은 가상 SessionRow로 변환 (id='pending-<queuedAt>', status='completed').
 *   - 같은 started_at은 dedupe — flush 직후 DB 행이 들어와도 중복 표시 안 됨.
 *   - 사용자가 race를 끝냈는데 Supabase 업로드가 실패한 경우에도 History 카드 +
 *     THIS MONTH/WEEK 거리가 즉시 반영됨.
 */
export function useSessionHistory() {
  const { isAuthenticated } = useAuthStore();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchedAtRef = useRef<number>(0);
  const sessionsRef = useRef<SessionRow[]>([]);
  sessionsRef.current = sessions;

  const load = useCallback(
    async (limit = 100, options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const pendingRows = pendingQueueAsRows();
      const now = Date.now();
      const cacheAge = now - lastFetchedAtRef.current;
      const hasCache = sessionsRef.current.length > 0 || lastFetchedAtRef.current > 0;

      // 캐시 hit — TTL 안이고 force 아니면 즉시 반환 (네트워크 안 함)
      if (!force && hasCache && cacheAge < FETCH_TTL_MS) {
        // pending queue는 매번 머지 (최신 큐 반영)
        const merged = mergeWithPending(sessionsRef.current.filter((s) => s.user_id !== 'pending'), pendingRows);
        if (merged.length !== sessionsRef.current.length) setSessions(merged);
        return merged;
      }

      if (!isAuthenticated) {
        setSessions(pendingRows);
        return pendingRows;
      }
      try {
        setLoading(true);
        const rows = await fetchSessions(limit);
        const merged = mergeWithPending(rows, pendingRows);
        setSessions(merged);
        lastFetchedAtRef.current = Date.now();
        return merged;
      } catch (e) {
        console.warn('[useSessionHistory] fetch error:', e);
        setSessions(pendingRows);
        return pendingRows;
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
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
