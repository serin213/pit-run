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
  /** 클라이언트 생성 UUID. withRetry가 server-side 성공한 INSERT를 재시도해서
   *  생기는 중복 row 차단 (at-least-once delivery 문제 해결). */
  id?: string;
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

    const row = {
      user_id: userId,
      one_km_ms: Math.round(fields.one_km_ms),
      pace_sec_per_km: fields.pace_sec_per_km,
      grade: fields.grade,
      warmup_minutes: Math.round(fields.warmup_minutes),
      ...(fields.id ? { id: fields.id } : {}),
    };

    const query = fields.id
      ? supabase.from('qualifying_results').upsert(row, { onConflict: 'id' }).select().single()
      : supabase.from('qualifying_results').insert(row).select().single();
    const { data, error } = await query;
    if (error) {
      recordSaveError('qualifying_results', error);
      throw error;
    }
    recordSaveSuccess('qualifying_results');
    return data;
  });
}
