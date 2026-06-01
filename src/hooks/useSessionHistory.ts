import { useCallback, useState } from 'react';
import { fetchSessions, type SessionRow } from '../api/sessions';
import { getPendingQueue } from '../api/pendingSessions';
import { useAuthStore } from '../store/authStore';

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

  const load = useCallback(
    async (limit = 100) => {
      const pendingRows = pendingQueueAsRows();

      if (!isAuthenticated) {
        // 인증 안 됐어도 pending queue 자체는 표시 — 오프라인 시작한 사용자가
        // 자기 race 결과를 history에서 볼 수 있게.
        setSessions(pendingRows);
        return pendingRows;
      }
      try {
        setLoading(true);
        const rows = await fetchSessions(limit);
        const merged = mergeWithPending(rows, pendingRows);
        setSessions(merged);
        return merged;
      } catch (e) {
        console.warn('[useSessionHistory] fetch error:', e);
        // fetch 실패 시 pending만이라도 표시
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
