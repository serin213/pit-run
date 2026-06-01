import { supabase, withRetry } from './client';

export type ProfileRow = {
  user_id: string;
  display_name: string;
  race_number: string;
  accent_color: string;
  created_at: string;
  updated_at: string;
};

/** 현재 로그인 유저의 프로필 조회 */
export async function fetchProfile(): Promise<ProfileRow | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }
    return data;
  });
}

/**
 * 프로필 upsert (회원가입 직후 or 수정).
 *
 * 안정성 패턴 (insertCompletedSession와 동일):
 *   - auth.getSession() — MMKV 캐시. 이전 getUser()는 네트워크 호출이라
 *     ProfileSetupScreen에서 network transition 시 silent fail로 프로필 행이
 *     Supabase에 영영 안 들어가는 버그 유발.
 *   - auth 체크가 withRetry 안으로 들어옴 → 일시적 실패 자동 재시도.
 */
export async function upsertProfile(fields: {
  display_name: string;
  race_number?: string;
  accent_color?: string;
}): Promise<ProfileRow> {
  return withRetry(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, ...fields })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
}
