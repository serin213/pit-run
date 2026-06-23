-- =============================================================
-- PIT RUN  --  Live Activity APNs push tokens
-- =============================================================
-- iOS ActivityKit이 pushType:.token으로 발급한 토큰을 저장한다.
-- 서버(Edge Function)가 이 토큰으로 Lock Screen / Dynamic Island를
-- 원격 갱신(apns-push-type: liveactivity)한다.
-- 로컬 GPS/오디오 트리거 소유권과 무관 — 렌더 신뢰성 보강 전용.

create table if not exists public.live_activity_push_tokens (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  -- 클라이언트 생성 race UUID (runStore.raceId). 한 레이스가 여러 토큰 rotation을
  -- 가질 수 있으므로 race_id로 묶어 조회한다.
  race_id                 text,
  -- ActivityKit activity.id — 전역 고유. upsert 충돌 키.
  activity_id             text not null,
  -- APNs push token (소문자 hex).
  push_token              text not null,
  -- 'sandbox' | 'production' — 디바이스 빌드 종류. 서버 APNS_ENV와 교차검증용.
  environment             text not null default 'production'
                            check (environment in ('sandbox','production')),
  -- NSSupportsLiveActivitiesFrequentUpdates 사용자 허용 여부.
  frequent_pushes_enabled boolean not null default false,
  -- 'active' | 'ended' — LA 종료 시 'ended'로 전환, 서버는 active만 push.
  status                  text not null default 'active'
                            check (status in ('active','ended')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  ended_at                timestamptz,
  unique (activity_id)
);

create index if not exists idx_la_push_tokens_user
  on public.live_activity_push_tokens (user_id);
create index if not exists idx_la_push_tokens_race
  on public.live_activity_push_tokens (race_id);
create index if not exists idx_la_push_tokens_status
  on public.live_activity_push_tokens (status);

drop trigger if exists live_activity_push_tokens_updated_at on public.live_activity_push_tokens;
create trigger live_activity_push_tokens_updated_at
  before update on public.live_activity_push_tokens
  for each row execute function public.set_updated_at();

-- =============================================================
-- Row Level Security — 사용자는 자신의 row만 관리.
-- (서버 Edge Function은 service_role 키로 RLS 우회해 전체 조회.)
-- =============================================================
alter table public.live_activity_push_tokens enable row level security;

drop policy if exists "Users can view own LA push tokens" on public.live_activity_push_tokens;
create policy "Users can view own LA push tokens"
  on public.live_activity_push_tokens for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own LA push tokens" on public.live_activity_push_tokens;
create policy "Users can insert own LA push tokens"
  on public.live_activity_push_tokens for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own LA push tokens" on public.live_activity_push_tokens;
create policy "Users can update own LA push tokens"
  on public.live_activity_push_tokens for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own LA push tokens" on public.live_activity_push_tokens;
create policy "Users can delete own LA push tokens"
  on public.live_activity_push_tokens for delete using (auth.uid() = user_id);
