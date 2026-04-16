import { useCallback, useEffect, useState } from 'react';
import {
  fetchLatestQualifying,
  insertQualifying,
  type QualifyingRow,
} from '../api/qualifying';
import { useAuthStore } from '../store/authStore';
import type { QualifyingGrade } from '../types';

/**
 * 최신 퀄리파잉 결과를 Supabase에서 가져오고, 새 결과를 저장하는 훅.
 */
export function useSupabaseQualifying() {
  const { isAuthenticated } = useAuthStore();
  const [latest, setLatest] = useState<QualifyingRow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLatest(null);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchLatestQualifying();
      setLatest(data);
    } catch (e) {
      console.warn('[useSupabaseQualifying] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const saveResult = useCallback(
    async (fields: {
      one_km_ms: number;
      pace_sec_per_km: number;
      grade: QualifyingGrade;
      warmup_minutes: number;
    }) => {
      if (!isAuthenticated) return null;
      const row = await insertQualifying(fields);
      setLatest(row);
      return row;
    },
    [isAuthenticated],
  );

  return { latest, loading, reload: load, saveResult };
}
