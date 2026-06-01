import { useCallback, useEffect, useState } from 'react';
import { fetchProfile, upsertProfile, type ProfileRow } from '../api/profiles';
import { setPendingProfile } from '../api/pendingMutations';
import { useAuthStore } from '../store/authStore';

/**
 * Supabase profiles 테이블과 동기화하는 훅.
 * 로그인 상태에서만 fetch하며, 비로그인 시 null 반환.
 */
export function useSupabaseProfile() {
  const { isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchProfile();
      setProfile(data);
    } catch (e) {
      console.warn('[useSupabaseProfile] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!isAuthenticated) return;
      const updated = await upsertProfile({ display_name: displayName });
      setProfile(updated);
    },
    [isAuthenticated],
  );

  /**
   * 프로필 필드 저장 (upsertProfile 래퍼).
   *
   * 실패해도 silent drop 금지 — pending profile slot에 적재:
   *   - !isAuthenticated → setPendingProfile(fields)
   *   - upsertProfile throw → setPendingProfile(fields)
   * 다음 launch의 useSyncOnLogin이 flush 시도.
   *
   * upsertProfile는 이미 getSession + withRetry라 일상적 실패율 낮음. 큐는 백업.
   */
  const save = useCallback(
    async (fields: { display_name: string; race_number?: string; accent_color?: string }) => {
      if (!isAuthenticated) {
        console.warn('[useSupabaseProfile] not authenticated, queuing profile for next launch');
        setPendingProfile(fields);
        return null;
      }
      try {
        const updated = await upsertProfile(fields);
        setProfile(updated);
        return updated;
      } catch (e) {
        console.warn('[useSupabaseProfile] save error, queuing for retry:', e);
        setPendingProfile(fields);
        return null;
      }
    },
    [isAuthenticated],
  );

  return { profile, loading, reload: load, updateDisplayName, save };
}
