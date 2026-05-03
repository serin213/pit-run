import { useCallback, useEffect, useState } from 'react';
import { fetchProfile, upsertProfile, type ProfileRow } from '../api/profiles';
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

  /** 프로필 필드 저장 (upsertProfile 래퍼). 성공 시 로컬 상태도 갱신. */
  const save = useCallback(
    async (fields: { display_name: string; race_number?: string; accent_color?: string }) => {
      if (!isAuthenticated) return null;
      try {
        const updated = await upsertProfile(fields);
        setProfile(updated);
        return updated;
      } catch (e) {
        console.warn('[useSupabaseProfile] save error:', e);
        return null;
      }
    },
    [isAuthenticated],
  );

  return { profile, loading, reload: load, updateDisplayName, save };
}
