/**
 * Offline pending session queue
 *
 * insertCompletedSession이 네트워크 오류 등으로 3회 재시도 후에도 실패하면
 * 세션 데이터를 MMKV에 저장. 다음 앱 시작 시 usePendingSessionFlush 훅이
 * 인증 완료 후 자동으로 재시도해 Supabase에 INSERT.
 *
 * 데이터 유실 방지 원칙:
 *   - 큐 엔트리는 started_at으로 중복 방지 (같은 세션 2번 저장 방지)
 *   - INSERT 성공 후에만 큐에서 제거
 *   - 실패 시 그대로 유지 → 다음 앱 실행 시 재시도
 */

import { getString, setString } from '../platform/storage';
import type { SessionType } from './sessions';

const PENDING_KEY = 'pending_sessions_v1';

export type PendingSessionFields = {
  /** 클라이언트 생성 UUID (race의 경우). flush 시 그대로 insertCompletedSession에 전달
   *  되어 기존 row가 있으면 그대로 반환됨 → flush 재시도 시 중복 INSERT 차단. */
  id?: string;
  type: SessionType;
  circuit_id?: string | null;
  started_at: string;
  total_dist_km: number;
  total_time_ms: number;
  avg_pace_sec_per_km?: number | null;
  best_pace_sec_per_km?: number | null;
  payload?: Record<string, unknown>;
  /** 큐 추가 시각 — 중복 제거 및 순서 보장용 */
  _queuedAt: string;
};

export type PendingSessionInput = Omit<PendingSessionFields, '_queuedAt'>;

function readQueue(): PendingSessionFields[] {
  const raw = getString(PENDING_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PendingSessionFields[]; }
  catch { return []; }
}

function writeQueue(queue: PendingSessionFields[]): void {
  setString(PENDING_KEY, JSON.stringify(queue));
}

/**
 * 저장 실패한 세션을 큐에 추가.
 * started_at이 동일한 항목이 이미 있으면 중복 추가하지 않음.
 */
export function enqueuePendingSession(fields: PendingSessionInput): void {
  const queue = readQueue();
  const alreadyQueued = queue.some((q) => q.started_at === fields.started_at);
  if (alreadyQueued) return;
  queue.push({ ...fields, _queuedAt: new Date().toISOString() });
  writeQueue(queue);
  console.warn(`[PendingQueue] Queued session started_at=${fields.started_at}. Queue size: ${queue.length}`);
}

/**
 * 큐에서 세션 목록 조회 — flush 훅에서 사용.
 */
export function getPendingQueue(): PendingSessionFields[] {
  return readQueue();
}

/**
 * 성공적으로 INSERT된 세션을 큐에서 제거.
 */
export function removePendingSession(queuedAt: string): void {
  const queue = readQueue().filter((s) => s._queuedAt !== queuedAt);
  writeQueue(queue);
}

/**
 * 큐 전체 비우기 — 개발/디버그용.
 */
export function clearPendingQueue(): void {
  writeQueue([]);
}

/**
 * 큐에 항목이 있는지 확인.
 */
export function hasPendingSessions(): boolean {
  return readQueue().length > 0;
}
