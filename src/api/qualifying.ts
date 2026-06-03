import { supabase, withRetry } from './client';
import { recordSaveAttempt, recordSaveSuccess, recordSaveError, recordAuthState } from './saveDiag';
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

/**
 * 퀄리파잉 결과 저장.
 *
 * 안정성 패턴 (insertCompletedSession와 동일):
 *   - auth.getSession() — MMKV 캐시 읽기, 오프라인/배경 GPS 동작 중에도 안정
 *     (이전 getUser()는 네트워크 호출이라 background에서 timeout 자주 발생 → throw)
 *   - auth 체크 + INSERT 모두 withRetry 루프 안에 포함 → 일시적 네트워크/auth
 *     문제는 자동 재시도로 해결
 *   - JWT는 어차피 서버 INSERT 헤더에서 검증되므로 client 측 getUser는 불필요한
 *     duplication
 */
export async function insertQualifying(fields: {
  one_km_ms: number;
  pace_sec_per_km: number;
  grade: QualifyingGrade;
  warmup_minutes: number;
}): Promise<QualifyingRow> {
  return withRetry(async () => {
    recordSaveAttempt('qualifying_results');
    const { data: { session } } = await supabase.auth.getSession();
    recordAuthState(session);
    const userId = session?.user?.id;
    if (!userId) {
      const err = new Error('Not authenticated');
      recordSaveError('qualifying_results', err);
      throw err;
    }

    const { data, error } = await supabase
      .from('qualifying_results')
      .insert({
        user_id: userId,
        ...fields,
        // one_km_ms / warmup_minutes 도 integer 컬럼. trialElapsedMs는 Date.now()
        // 기반이라 이미 integer지만 방어적으로 round (PG 22P02 방어).
        one_km_ms: Math.round(fields.one_km_ms),
        warmup_minutes: Math.round(fields.warmup_minutes),
      })
      .select()
      .single();
    if (error) {
      recordSaveError('qualifying_results', error);
      throw error;
    }
    recordSaveSuccess('qualifying_results');
    return data;
  });
}
