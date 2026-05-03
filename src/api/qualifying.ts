import { supabase, withRetry } from './client';
import type { QualifyingGrade } from '../types';

export type QualifyingRow = {
  id: string;
  user_id: string;
  recorded_at: string;
  one_km_ms: number;
  pace_sec_per_km: number;
  grade: QualifyingGrade;
  percentile: number | null;
  warmup_minutes: number;
};

/** 최신 퀄리파잉 결과 조회 */
export async function fetchLatestQualifying(): Promise<QualifyingRow | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('qualifying_results')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

/** 전체 퀄리파잉 기록 조회 */
export async function fetchQualifyingHistory(): Promise<QualifyingRow[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('qualifying_results')
      .select('*')
      .order('recorded_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

/** 퀄리파잉 결과 저장 */
export async function insertQualifying(fields: {
  one_km_ms: number;
  pace_sec_per_km: number;
  grade: QualifyingGrade;
  warmup_minutes: number;
}): Promise<QualifyingRow> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('qualifying_results')
    .insert({ user_id: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}
