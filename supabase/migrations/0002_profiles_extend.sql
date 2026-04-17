-- =============================================================
-- PIT RUN  --  Extend profiles with race_number and accent_color
-- =============================================================

alter table public.profiles
  add column if not exists race_number text not null default '',
  add column if not exists accent_color text not null default '#E03A3E';
