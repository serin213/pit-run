/**
 * Pending mutation queue (qualifying + profile).
 *
 * insertCompletedSession는 별도 pendingSessions.ts에서 처리 (이미 검증된 코드).
 * 이 파일은 qualifying / profile 저장이 실패한 경우의 fallback 큐를 담당.
 *
 * 정책:
 *   - qualifying: append-only. 같은 recorded_at 중복 적재 방지.
 *   - profile: 최신 desired state만 유지 (single slot, upsert이므로 마지막 값이 진실).
 *   - flush는 useSyncOnLogin이 launch 시점에 호출.
 */

import { getString, setString } from '../platform/storage';
import type { QualifyingGrade } from '../types';

// ── Qualifying queue ─────────────────────────────────────────────────────────

const PENDING_QUAL_KEY = 'pending_qualifying_v1';

export type PendingQualifyingFields = {
  one_km_ms: number;
  pace_sec_per_km: number;
  grade: QualifyingGrade;
  warmup_minutes: number;
  /** 큐 추가 시각 — 중복 제거용 */
  _queuedAt: string;
};

export type PendingQualifyingInput = Omit<PendingQualifyingFields, '_queuedAt'>;

function readQualQueue(): PendingQualifyingFields[] {
  const raw = getString(PENDING_QUAL_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PendingQualifyingFields[]; }
  catch { return []; }
}

function writeQualQueue(queue: PendingQualifyingFields[]): void {
  setString(PENDING_QUAL_KEY, JSON.stringify(queue));
}

export function enqueuePendingQualifying(fields: PendingQualifyingInput): void {
  const queue = readQualQueue();
  const _queuedAt = new Date().toISOString();
  // grade + pace + ms가 모두 같은 항목이 이미 있으면 같은 시도로 보고 중복 적재 안 함.
  // 같은 결과로 재시도하는 거라 일종의 idempotency 보장.
  const dup = queue.some(
    (q) =>
      q.one_km_ms === fields.one_km_ms &&
      q.pace_sec_per_km === fields.pace_sec_per_km &&
      q.grade === fields.grade,
  );
  if (dup) return;
  queue.push({ ...fields, _queuedAt });
  writeQualQueue(queue);
  console.warn(`[PendingQueue/qual] Queued grade=${fields.grade}. Queue size: ${queue.length}`);
}

export function getPendingQualifyingQueue(): PendingQualifyingFields[] {
  return readQualQueue();
}

export function removePendingQualifying(queuedAt: string): void {
  writeQualQueue(readQualQueue().filter((q) => q._queuedAt !== queuedAt));
}

// ── Profile slot ─────────────────────────────────────────────────────────────

const PENDING_PROFILE_KEY = 'pending_profile_v1';

export type PendingProfileFields = {
  display_name: string;
  race_number?: string;
  accent_color?: string;
};

export function setPendingProfile(fields: PendingProfileFields): void {
  setString(PENDING_PROFILE_KEY, JSON.stringify(fields));
  console.warn(`[PendingQueue/profile] Queued display_name=${fields.display_name}`);
}

export function getPendingProfile(): PendingProfileFields | null {
  const raw = getString(PENDING_PROFILE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as PendingProfileFields; }
  catch { return null; }
}

export function clearPendingProfile(): void {
  setString(PENDING_PROFILE_KEY, '');
}
