import { supabase } from './client';

export type DeviceRow = {
  id: string;
  user_id: string;
  push_token: string;
  platform: 'ios' | 'android';
  last_seen_at: string;
};

/** 디바이스 push token 등록/갱신 */
export async function upsertDevice(fields: {
  push_token: string;
  platform: 'ios' | 'android';
}): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  await supabase.from('devices').upsert(
    {
      user_id: userId,
      push_token: fields.push_token,
      platform: fields.platform,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,push_token' },
  );
}

/** 디바이스 삭제 (로그아웃 시) */
export async function removeDevice(pushToken: string): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;
  await supabase.from('devices').delete().eq('push_token', pushToken).eq('user_id', userId);
}
