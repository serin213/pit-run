import { supabase } from './client';

/**
 * 현재 로그인된 사용자의 계정 + 모든 관련 데이터 영구 삭제.
 * auth.users 삭제 → CASCADE로 profiles, qualifying_results, run_sessions,
 * interval_plans, activity_dates, devices, analytics_events 전부 삭제.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_current_user');
  if (error) throw error;
}
