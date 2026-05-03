import { useCallback, useState } from 'react';
import { fetchSessions, type SessionRow } from '../api/sessions';
import { useAuthStore } from '../store/authStore';

/**
 * 세션 히스토리 조회 훅.
 * HomeScreen, HistoryScreen 등에서 fetchSessions 직접 호출 대신 사용.
 */
export function useSessionHistory() {
  const { isAuthenticated } = useAuthStore();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (limit = 100) => {
      if (!isAuthenticated) {
        setSessions([]);
        return [];
      }
      try {
        setLoading(true);
        const rows = await fetchSessions(limit);
        setSessions(rows);
        return rows;
      } catch (e) {
        console.warn('[useSessionHistory] fetch error:', e);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  return { sessions, loading, load };
}
