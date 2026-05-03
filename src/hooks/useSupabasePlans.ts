import { useCallback } from 'react';
import { insertPlan, type PlanRow } from '../api/plans';
import { useAuthStore } from '../store/authStore';
import type { IntervalSegment } from '../api/plans';

/**
 * 인터벌 플랜 저장 훅.
 * QualifyingScreen에서 insertPlan 직접 호출 대신 사용.
 */
export function useSupabasePlans() {
  const { isAuthenticated } = useAuthStore();

  const savePlan = useCallback(
    async (fields: {
      based_on_qualifying_id?: string | null;
      segments: IntervalSegment[];
      session_id?: string | null;
    }): Promise<PlanRow | null> => {
      if (!isAuthenticated) return null;
      try {
        return await insertPlan(fields);
      } catch (e) {
        console.warn('[useSupabasePlans] save error:', e);
        return null;
      }
    },
    [isAuthenticated],
  );

  return { savePlan };
}
