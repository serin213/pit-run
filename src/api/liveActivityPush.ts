/**
 * Live Activity APNs push token 등록/갱신/종료 API.
 *
 * 토스 미니앱 호환: Supabase 호출은 전부 이 api 레이어에 격리한다 (CLAUDE.md §3).
 * 플랫폼 코드(src/platform/liveActivity.ts)가 토큰을 받으면 이 함수들을 호출한다.
 *
 * 주의: APNs auth key(.p8)는 절대 모바일 앱에 두지 않는다. 앱은 토큰만 등록하고,
 *       실제 push 전송은 서버(supabase/functions/live-activity-push)가 담당한다.
 */

import { supabase, withRetry } from './client';
import type {
  LiveActivityContentState,
  LiveActivityPushEvent,
} from '../core/liveActivityPayload';

export type LiveActivityEnvironment = 'sandbox' | 'production';
export type LiveActivityTokenStatus = 'active' | 'ended';

export type LiveActivityPushTokenRow = {
  id: string;
  user_id: string;
  race_id: string | null;
  activity_id: string;
  push_token: string;
  environment: LiveActivityEnvironment;
  frequent_pushes_enabled: boolean;
  status: LiveActivityTokenStatus;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type RegisterLiveActivityTokenInput = {
  activityId: string;
  pushToken: string;
  environment: LiveActivityEnvironment;
  frequentPushesEnabled: boolean;
  raceId?: string | null;
};

/**
 * APNs Live Activity push token 등록/갱신.
 * activity_id 충돌 시 upsert — 토큰 rotation을 같은 row에 반영한다.
 * 미로그인이면 조용히 skip (토큰은 plat 레이어에 보존돼 로그인 후 재시도 가능).
 */
export async function registerLiveActivityToken(
  input: RegisterLiveActivityTokenInput,
): Promise<void> {
  await withRetry(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const { error } = await supabase.from('live_activity_push_tokens').upsert(
      {
        user_id: userId,
        race_id: input.raceId ?? null,
        activity_id: input.activityId,
        push_token: input.pushToken,
        environment: input.environment,
        frequent_pushes_enabled: input.frequentPushesEnabled,
        status: 'active',
        ended_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'activity_id' },
    );
    if (error) throw error;
  });
}

/**
 * Live Activity 종료 표시 — 서버는 status='active'인 토큰만 push하므로,
 * 이걸로 더 이상 push 대상이 아님을 알린다. 미로그인/미존재면 no-op.
 */
export async function endLiveActivityToken(activityId: string): Promise<void> {
  await withRetry(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .from('live_activity_push_tokens')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('activity_id', activityId)
      .eq('user_id', userId);
    if (error) throw error;
  });
}

export type SendLiveActivityPushInput = {
  activityId: string;
  contentState: LiveActivityContentState;
  /** 5: 일반 거리 갱신 · 10: boxbox/fullPush/final/finish 시각 전환 */
  priority: 5 | 10;
  event?: LiveActivityPushEvent;
  staleDateMs?: number;
  relevanceScore?: number;
  dismissalDateMs?: number;
};

/**
 * Edge Function(live-activity-push)을 호출해 APNs Live Activity push를 보낸다.
 * 서버가 토큰 조회 + APNs JWT 서명 + 전송을 담당한다 (.p8 키는 서버에만 존재).
 *
 * best-effort — 실패해도 로컬 Activity.update 폴백이 화면을 갱신하고,
 * 로컬 GPS/사운드 트리거와는 완전히 독립적이다. 절대 throw하지 않는다.
 */
export async function sendLiveActivityPush(input: SendLiveActivityPushInput): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('live-activity-push', {
      body: {
        activityId: input.activityId,
        contentState: input.contentState,
        priority: input.priority,
        event: input.event ?? 'update',
        staleDateMs: input.staleDateMs,
        relevanceScore: input.relevanceScore,
        dismissalDateMs: input.dismissalDateMs,
      },
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}
