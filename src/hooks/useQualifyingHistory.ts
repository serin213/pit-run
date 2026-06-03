import { useCallback, useRef, useState } from 'react';
import { fetchQualifyingHistory, type QualifyingRow } from '../api/qualifying';
import { useAuthStore } from '../store/authStore';

const FETCH_TTL_MS = 30_000;

/**
 * 전체 퀄리파잉 기록 조회 훅.
 * 30초 TTL 캐시 — 같은 데이터를 짧은 시간에 재요청하면 캐시 반환.
 */
export function useQualifyingHistory() {
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<QualifyingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchedAtRef = useRef<number>(0);
  const historyRef = useRef<QualifyingRow[]>([]);
  historyRef.current = history;

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    const cacheAge = Date.now() - lastFetchedAtRef.current;
    const hasCache = historyRef.current.length > 0 || lastFetchedAtRef.current > 0;

    if (!force && hasCache && cacheAge < FETCH_TTL_MS) {
      return historyRef.current;
    }

    if (!isAuthenticated) {
      setHistory([]);
      return [];
    }
    try {
      setLoading(true);
      const rows = await fetchQualifyingHistory();
      setHistory(rows);
      lastFetchedAtRef.current = Date.now();
      return rows;
    } catch (e) {
      console.warn('[useQualifyingHistory] fetch error:', e);
      return historyRef.current;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  return { history, loading, load };
}
