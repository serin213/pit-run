import { supabase, withRetry } from './client';

export type SessionType = 'practice' | 'qualifying' | 'grand_prix';
export type SessionStatus = 'completed' | 'abandoned';

export type SessionRow = {
  id: string;
  user_id: string;
  type: SessionType;
  circuit_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
  total_dist_km: number;
  total_time_ms: number;
  avg_pace_sec_per_km: number | null;
  best_pace_sec_per_km: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

/** 세션 목록 조회 (최근순) */
export async function fetchSessions(limit = 50): Promise<SessionRow[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('run_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

/** 세션 생성 (러닝 시작) */
export async function insertSession(fields: {
  type: SessionType;
  circuit_id?: string | null;
  started_at?: string;
}): Promise<SessionRow> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('run_sessions')
    .insert({
      user_id: userId,
      type: fields.type,
      circuit_id: fields.circuit_id ?? null,
      started_at: fields.started_at ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** 세션 완료 업데이트 */
export async function completeSession(
  sessionId: string,
  fields: {
    status: SessionStatus;
    total_dist_km: number;
    total_time_ms: number;
    avg_pace_sec_per_km?: number | null;
    best_pace_sec_per_km?: number | null;
    payload?: Record<string, unknown>;
  },
): Promise<SessionRow> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('run_sessions')
      .update({
        ended_at: new Date().toISOString(),
        ...fields,
      })
      .eq('id', sessionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  });
}
