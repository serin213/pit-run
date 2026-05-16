-- =============================================================
-- PIT RUN  --  Analytics events table
-- =============================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  event_id   uuid        PRIMARY KEY,
  event_type text        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp  bigint      NOT NULL,
  payload    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users insert own events" ON public.analytics_events;
CREATE POLICY "users insert own events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type
  ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp
  ON public.analytics_events (timestamp);
