import { supabase } from './client';

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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data;
}

/** 프로필 upsert (회원가입 직후 or 수정) */
export async function upsertProfile(fields: {
  display_name: string;
  race_number?: string;
  accent_color?: string;
}): Promise<ProfileRow> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}
