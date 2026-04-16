-- =============================================================
-- PIT RUN  --  Initial schema
-- Supabase (Postgres 15+)  |  ap-northeast-2  |  2026-04-16
-- =============================================================

-- 0. Extensions
create extension if not exists "uuid-ossp" with schema extensions;

-- 1. Helper: auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =============================================================
-- 2. Tables
-- =============================================================

-- 2-1. profiles
create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 2-2. qualifying_results
create table public.qualifying_results (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  recorded_at       timestamptz not null default now(),
  one_km_ms         int not null,
  pace_sec_per_km   numeric(7,2) not null,
  grade             text not null check (grade in ('f1_champion','f1','f1_rookie','f2','f3')),
  percentile        numeric(5,2),
  warmup_minutes    int not null default 5
);

create index idx_qualifying_results_user on public.qualifying_results(user_id);

-- 2-3. run_sessions
create table public.run_sessions (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  type                 text not null check (type in ('practice','qualifying','grand_prix')),
  circuit_id           text,
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  status               text not null default 'completed' check (status in ('completed','abandoned')),
  total_dist_km        numeric(8,3) not null default 0,
  total_time_ms        int not null default 0,
  avg_pace_sec_per_km  numeric(7,2),
  best_pace_sec_per_km numeric(7,2),
  payload              jsonb default '{}',
  created_at           timestamptz not null default now()
);

create index idx_run_sessions_user on public.run_sessions(user_id);

-- 2-4. interval_plans
create table public.interval_plans (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  generated_at           timestamptz not null default now(),
  based_on_qualifying_id uuid references public.qualifying_results(id) on delete set null,
  segments               jsonb not null default '[]',
  session_id             uuid references public.run_sessions(id) on delete set null
);

create index idx_interval_plans_user on public.interval_plans(user_id);

-- 2-5. activity_dates
create table public.activity_dates (
  user_id uuid not null references auth.users(id) on delete cascade,
  date    date not null,
  primary key (user_id, date)
);

-- 2-6. devices
create table public.devices (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  push_token   text not null,
  platform     text not null check (platform in ('ios','android')),
  last_seen_at timestamptz not null default now(),
  unique (user_id, push_token)
);

create index idx_devices_user on public.devices(user_id);

-- =============================================================
-- 3. Row Level Security
-- =============================================================

alter table public.profiles          enable row level security;
alter table public.qualifying_results enable row level security;
alter table public.run_sessions      enable row level security;
alter table public.interval_plans    enable row level security;
alter table public.activity_dates    enable row level security;
alter table public.devices           enable row level security;

-- profiles
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = user_id);

-- qualifying_results
create policy "Users can view own qualifying"
  on public.qualifying_results for select using (auth.uid() = user_id);
create policy "Users can insert own qualifying"
  on public.qualifying_results for insert with check (auth.uid() = user_id);

-- run_sessions
create policy "Users can view own sessions"
  on public.run_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions"
  on public.run_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions"
  on public.run_sessions for update using (auth.uid() = user_id);

-- interval_plans
create policy "Users can view own plans"
  on public.interval_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plans"
  on public.interval_plans for insert with check (auth.uid() = user_id);

-- activity_dates
create policy "Users can view own activity"
  on public.activity_dates for select using (auth.uid() = user_id);
create policy "Users can insert own activity"
  on public.activity_dates for insert with check (auth.uid() = user_id);

-- devices
create policy "Users can view own devices"
  on public.devices for select using (auth.uid() = user_id);
create policy "Users can insert own devices"
  on public.devices for insert with check (auth.uid() = user_id);
create policy "Users can update own devices"
  on public.devices for update using (auth.uid() = user_id);
create policy "Users can delete own devices"
  on public.devices for delete using (auth.uid() = user_id);
