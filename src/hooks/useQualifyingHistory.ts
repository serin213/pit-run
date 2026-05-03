import { useCallback, useState } from 'react';
import { fetchQualifyingHistory, type QualifyingRow } from '../api/qualifying';
import { useAuthStore } from '../store/authStore';

/**
 * 전체 퀄리파잉 기록 조회 훅.
 * HistoryScreen에서 fetchQualifyingHistory 직접 호출 대신 사용.
 */
export function useQualifyingHistory() {
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<QualifyingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setHistory([]);
      return [];
    }
    try {
      setLoading(true);
      const rows = await fetchQualifyingHistory();
      setHistory(rows);
      return rows;
    } catch (e) {
      console.warn('[useQualifyingHistory] fetch error:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  return { history, loading, load };
}
