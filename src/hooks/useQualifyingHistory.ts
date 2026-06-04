import { useCallback, useState } from 'react';
import { fetchQualifyingHistory, type QualifyingRow } from '../api/qualifying';
import { useAuthStore } from '../store/authStore';
import {
  HISTORY_FETCH_TTL_MS,
  getQualifyingCache,
  setQualifyingCache,
} from '../api/historyCache';

/**
 * 전체 퀄리파잉 기록 조회 훅.
 *
 * useSessionHistory와 동일한 캐시 전략:
 *   - 모듈 캐시는 src/api/historyCache.ts에서 관리.
 *   - HistoryScreen 마운트 시 트렌드 그래프 즉시 표시.
 *   - userId 매칭으로 계정 전환 안전.
 *   - Stale-while-revalidate.
 *   - saveResult 성공 시 invalidateQualifyingCache()로 강제 새로고침.
 */
export function useQualifyingHistory() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  const [history, setHistory] = useState<QualifyingRow[]>(() => {
    const cache = getQualifyingCache();
    if (cache && userId && cache.userId === userId) return cache.data;
    return [];
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    const cache = getQualifyingCache();

    if (!force && cache && userId && cache.userId === userId) {
      const age = Date.now() - cache.fetchedAt;
      if (age < HISTORY_FETCH_TTL_MS) {
        setHistory(cache.data);
        return cache.data;
      }
    }

    if (!isAuthenticated || !userId) {
      setHistory([]);
      return [];
    }

    if (!force && cache && cache.userId === userId) {
      setHistory(cache.data);
    }

    try {
      setLoading(true);
      const rows = await fetchQualifyingHistory();
      setQualifyingCache(userId, rows);
      setHistory(rows);
      return rows;
    } catch (e) {
      console.warn('[useQualifyingHistory] fetch error:', e);
      const fallback = cache && cache.userId === userId ? cache.data : [];
      setHistory(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId]);

  return { history, loading, load };
}
