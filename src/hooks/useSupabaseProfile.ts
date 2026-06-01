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

  /**
   * 프로필 필드 저장 (upsertProfile 래퍼).
   *
   * 실패해도 silent drop 금지:
   *   - !isAuthenticated → console.warn + null 반환 (호출부에서 재시도 가능 시그널).
   *   - upsertProfile throw → console.warn으로 surface (e.g., 'PGRST116', network).
   *
   * 로컬 (appStore) 저장은 호출부(ProfileSetupScreen)에서 별도로 이미 처리되므로
   * 여기서 실패해도 로컬엔 보존됨 — useSyncOnLogin이 다음 launch에 push 재시도.
   */
  const save = useCallback(
    async (fields: { display_name: string; race_number?: string; accent_color?: string }) => {
      if (!isAuthenticated) {
        console.warn('[useSupabaseProfile] save skipped — not authenticated. Local kept; will retry on next launch sync.');
        return null;
      }
      try {
        const updated = await upsertProfile(fields);
        setProfile(updated);
        return updated;
      } catch (e) {
        console.warn('[useSupabaseProfile] save error (local kept; sync will retry):', e);
        return null;
      }
    },
    [isAuthenticated],
  );

  return { profile, loading, reload: load, updateDisplayName, save };
}
