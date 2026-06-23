import { supabase, withRetry } from './client';
import { recordSaveAttempt, recordSaveSuccess, recordSaveError, recordAuthState } from './saveDiag';

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

/** 세션 완료 업데이트 — total_time_ms는 integer 컬럼이라 round 필수 (PG 22P02 방어). */
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
      total_time_ms: Math.round(fields.total_time_ms),
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
  /**
   * 클라이언트 생성 UUID. 전달되면 같은 id row가 이미 있는지 먼저 조회한다.
   * 이미 저장된 race는 그대로 반환하고 업데이트하지 않는다.
   * 네트워크 retry, pending flush, ResultScreen re-mount 모두 "first save wins".
   * 전달 안 되면 기존처럼 .insert (DB가 id 자동 생성).
   */
  id?: string;
  type: SessionType;
  circuit_id?: string | null;
  started_at: string;
  total_dist_km: number;
  total_time_ms: number;
  avg_pace_sec_per_km?: number | null;
  best_pace_sec_per_km?: number | null;
  payload?: Record<string, unknown>;
}): Promise<SessionRow> {
  return withRetry(async () => {
    recordSaveAttempt('run_sessions');
    const { data: { session } } = await supabase.auth.getSession();
    recordAuthState(session);
    const userId = session?.user?.id;
    if (!userId) {
      const err = new Error('Not authenticated');
      recordSaveError('run_sessions', err);
      throw err;
    }

    if (fields.id) {
      const { data: existingRow, error: existingError } = await supabase
        .from('run_sessions')
        .select('*')
        .eq('id', fields.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingRow) {
        recordSaveSuccess('run_sessions');
        return existingRow;
      }
    }

    const incomingTimeMs = Math.round(fields.total_time_ms);

    const row = {
      user_id: userId,
      type: fields.type,
      circuit_id: fields.circuit_id ?? null,
      started_at: fields.started_at,
      ended_at: new Date().toISOString(),
      status: 'completed' as SessionStatus,
      total_dist_km: fields.total_dist_km,
      // total_time_ms는 DB에서 integer 컬럼. useRunning RAF 루프의 dt 누적값
      // (elapsedMs)이 sub-ms precision float (예: 3863267.79)이라 raw 전달 시
      // PG 22P02 (invalid input syntax for type integer) 에러로 INSERT 거부됨.
      // API 레이어에서 round → fresh save + pending queue replay 모두 안전.
      total_time_ms: incomingTimeMs,
      avg_pace_sec_per_km: fields.avg_pace_sec_per_km ?? null,
      best_pace_sec_per_km: fields.best_pace_sec_per_km ?? null,
      payload: fields.payload ?? {},
      ...(fields.id ? { id: fields.id } : {}),
    };

    const { data, error } = await supabase
      .from('run_sessions')
      .insert(row)
      .select()
      .single();
    if (error) {
      recordSaveError('run_sessions', error);
      throw error;
    }
    recordSaveSuccess('run_sessions');
    return data;
  });
}
