/**
 * Analytics event API
 *
 * Supabase table (수동 생성 필요):
 *
 * CREATE TABLE analytics_events (
 *   event_id   UUID        PRIMARY KEY,
 *   event_type TEXT        NOT NULL,
 *   user_id    UUID        REFERENCES auth.users(id),
 *   timestamp  BIGINT      NOT NULL,
 *   payload    JSONB       NOT NULL DEFAULT '{}',
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 * ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "users insert own events"
 *   ON analytics_events FOR INSERT
 *   WITH CHECK (auth.uid() = user_id);
 */

import { supabase } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsEventRow {
  event_id: string;
  event_type: string;
  user_id: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * analytics_events 테이블에 이벤트 배치 upsert.
 * event_id 충돌 시 무시 (중복 전송 안전).
 */
export async function postAnalyticsEvents(rows: AnalyticsEventRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('analytics_events')
    .upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true });
  if (error) throw error;
}
