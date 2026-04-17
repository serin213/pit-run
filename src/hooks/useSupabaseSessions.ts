import { useCallback, useRef, useState } from 'react';
import {
  insertSession,
  completeSession,
  type SessionRow,
  type SessionType,
  type SessionStatus,
} from '../api/sessions';
import { recordActivityToday } from '../api/activity';
import { useAuthStore } from '../store/authStore';

/**
 * 러닝 세션을 Supabase에 기록하는 훅.
 * 세션 시작 → 완료/포기 흐름을 관리.
 */
export function useSupabaseSession() {
  const { isAuthenticated } = useAuthStore();
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const startSession = useCallback(
    async (type: SessionType, circuitId?: string | null) => {
      if (!isAuthenticated) return null;
      try {
        const row = await insertSession({ type, circuit_id: circuitId });
        setActiveSession(row);
        sessionIdRef.current = row.id;
        // 오늘 활동 기록
        recordActivityToday().catch(() => {});
        return row;
      } catch (e) {
        console.warn('[useSupabaseSession] start error:', e);
        return null;
      }
    },
    [isAuthenticated],
  );

  const endSession = useCallback(
    async (fields: {
      status: SessionStatus;
      total_dist_km: number;
      total_time_ms: number;
      avg_pace_sec_per_km?: number | null;
      best_pace_sec_per_km?: number | null;
      payload?: Record<string, unknown>;
    }) => {
      const id = sessionIdRef.current;
      if (!isAuthenticated || !id) return null;
      try {
        const row = await completeSession(id, fields);
        setActiveSession(null);
        sessionIdRef.current = null;
        return row;
      } catch (e) {
        console.warn('[useSupabaseSession] end error:', e);
        return null;
      }
    },
    [isAuthenticated],
  );

  return { activeSession, startSession, endSession };
}
