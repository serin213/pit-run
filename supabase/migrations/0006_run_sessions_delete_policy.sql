-- =============================================================
-- PIT RUN  --  Allow users to delete their own run_sessions
-- 짧은 세션(<0.10km, <1km qualifying) 조기 종료 시 행을 DB에서 직접 삭제
-- 하기 위한 RLS 정책 추가.
-- =============================================================

CREATE POLICY "Users can delete own sessions"
  ON public.run_sessions FOR DELETE
  USING (auth.uid() = user_id);
