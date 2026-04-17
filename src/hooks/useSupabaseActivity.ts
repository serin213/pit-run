import { useCallback, useEffect, useState } from 'react';
import { fetchActivityDates } from '../api/activity';
import { useAuthStore } from '../store/authStore';

/**
 * Supabase에서 활동 날짜 목록을 가져오는 훅.
 * 로그인 시 자동으로 fetch.
 */
export function useSupabaseActivity() {
  const { isAuthenticated } = useAuthStore();
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setDates([]);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchActivityDates();
      setDates(data);
    } catch (e) {
      console.warn('[useSupabaseActivity] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  return { dates, loading, reload: load };
}
