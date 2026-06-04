import { useCallback, useEffect, useState } from 'react';
import {
  fetchLatestQualifying,
  insertQualifying,
  type QualifyingRow,
} from '../api/qualifying';
import { enqueuePendingQualifying } from '../api/pendingMutations';
import { useAuthStore } from '../store/authStore';
import { invalidateQualifyingCache } from '../api/historyCache';
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

  /**
   * 퀄리파잉 결과 저장.
   *
   * 실패 시 silent drop 금지:
   *   - !isAuthenticated → pending queue 적재 (다음 launch flush)
   *   - insertQualifying throw (네트워크/RLS) → pending queue 적재
   *
   * insertQualifying는 이미 getSession + withRetry 패턴이라 실제 실패율은 낮지만,
   * 안전망으로 큐 적재 유지. 사용자 보고: qualifying_results 0행 상태 → 이 큐로
   * 최소한 다음 launch에서 복구 가능.
   */
  const saveResult = useCallback(
    async (fields: {
      /** 클라이언트 생성 UUID — withRetry 재시도 중복 차단용. QualifyingScreen에서
       *  startWarmup 시점에 1회 생성한 stable id 전달. */
      id?: string;
      one_km_ms: number;
      pace_sec_per_km: number;
      grade: QualifyingGrade;
      warmup_minutes: number;
    }) => {
      if (!isAuthenticated) {
        console.warn('[useSupabaseQualifying] not authenticated, queuing for next launch');
        enqueuePendingQualifying(fields);
        return null;
      }
      try {
        const row = await insertQualifying(fields);
        setLatest(row);
        // History 캐시 무효화 — 다음 useFocusEffect에서 새 row 즉시 표시.
        invalidateQualifyingCache();
        return row;
      } catch (e) {
        console.warn('[useSupabaseQualifying] saveResult failed, queuing for retry:', e);
        enqueuePendingQualifying(fields);
        return null;
      }
    },
    [isAuthenticated],
  );

  return { latest, loading, reload: load, saveResult };
}
