-- =============================================================
-- PIT RUN  --  Cleanup: remove run_sessions with distance < 0.10km
-- 신규 코드는 0.10km 미만 세션을 적재하지 않음. 이전에 적재된 짧은
-- 세션을 일회성으로 삭제하기 위한 스크립트.
-- =============================================================

DELETE FROM public.run_sessions
WHERE total_dist_km < 0.10;

-- 검증: 0건 남아있어야 정상
SELECT COUNT(*) AS short_sessions_remaining
FROM public.run_sessions
WHERE total_dist_km < 0.10;
