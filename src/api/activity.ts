import { supabase } from './client';

export type ActivityDateRow = {
  user_id: string;
  date: string;
};

/** 활동 날짜 목록 조회 */
export async function fetchActivityDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('activity_dates')
    .select('date')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.date);
}

/** 오늘 활동 기록 (이미 있으면 무시) */
export async function recordActivityToday(): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('activity_dates')
    .upsert({ user_id: userId, date: today }, { onConflict: 'user_id,date' });
}
