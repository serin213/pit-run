import { supabase } from './client';

export type IntervalSegment = {
  type: 'run' | 'recovery' | 'warmup' | 'cooldown';
  distanceM?: number;
  durationSec?: number;
  targetPaceSecPerKm?: number;
};

export type PlanRow = {
  id: string;
  user_id: string;
  generated_at: string;
  based_on_qualifying_id: string | null;
  segments: IntervalSegment[];
  session_id: string | null;
};

/** 최신 인터벌 플랜 조회 */
export async function fetchLatestPlan(): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from('interval_plans')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** 인터벌 플랜 생성 */
export async function insertPlan(fields: {
  based_on_qualifying_id?: string | null;
  segments: IntervalSegment[];
  session_id?: string | null;
}): Promise<PlanRow> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('interval_plans')
    .insert({
      user_id: userId,
      based_on_qualifying_id: fields.based_on_qualifying_id ?? null,
      segments: fields.segments,
      session_id: fields.session_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
