-- =============================================================
-- PIT RUN  --  User self-deletion RPC
-- 사용자가 자기 계정을 직접 삭제. CASCADE로 모든 관련 데이터 자동 정리.
-- =============================================================

CREATE OR REPLACE FUNCTION public.delete_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_current_user() TO authenticated;
