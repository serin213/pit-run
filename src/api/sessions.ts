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

/**
 * 세션 생성 (러닝 시작) — completed-only INSERT 정책 도입 이후 거의 안 쓰이지만,
 * 안정성 패턴 통일을 위해 insertCompletedSession와 동일 구조로 정리.
 */
export async function insertSession(fields: {
  type: SessionType;
  circuit_id?: string | null;
  started_at?: string;
}): Promise<SessionRow> {
  return withRetry(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
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
  });
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
}

/** 세션 삭제 — 조기 종료 / retire 시 호출. RLS DELETE 정책 필요 (0006 마이그레이션). */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('run_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

/**
 * 완료된 세션을 한 번에 INSERT.
 * 'started' 행을 먼저 만들었다가 UPDATE하는 패턴 대신, 완주가 확정된 시점에만 행 생성.
 * → retire / 중단 케이스에서 DB에 noise 행이 절대 남지 않음.
 *
 * Auth 전략:
 *   getUser()는 서버 검증 네트워크 요청 → GPS 종료 직후 불안정한 타이밍에 실패 가능.
 *   getSession()은 MMKV 캐시 읽기(오프라인 안전) — JWT는 서버 INSERT 시 헤더로 검증됨.
 *   → auth 체크도 withRetry 안으로 포함해 네트워크 복원 시 재시도 가능.
 */
export async function insertCompletedSession(fields: {
  type: SessionType;
  circuit_id?: string | null;
  started_at: string;
  total_dist_km: number;
  total_time_ms: number;
  avg_pace_sec_per_km?: number | null;
  best_pace_sec_per_km?: number | null;
  payload?: Record<string, unknown>;
}): Promise<SessionRow> {
  // GPS 종료 직후 네트워크 전환 타이밍에 실패하는 케이스 대비 — 최대 3회 재시도.
  // getSession()은 MMKV 캐시 읽기라 네트워크 불필요 → auth 체크도 retry 루프 안에서 안전.
  return withRetry(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('run_sessions')
      .insert({
        user_id: userId,
        type: fields.type,
        circuit_id: fields.circuit_id ?? null,
        started_at: fields.started_at,
        ended_at: new Date().toISOString(),
        status: 'completed' as SessionStatus,
        total_dist_km: fields.total_dist_km,
        total_time_ms: fields.total_time_ms,
        avg_pace_sec_per_km: fields.avg_pace_sec_per_km ?? null,
        best_pace_sec_per_km: fields.best_pace_sec_per_km ?? null,
        payload: fields.payload ?? {},
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
}
