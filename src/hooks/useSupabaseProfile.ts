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

  return { profile, loading, reload: load, updateDisplayName };
}
