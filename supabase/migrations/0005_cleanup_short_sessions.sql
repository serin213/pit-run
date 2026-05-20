-- =============================================================
-- PIT RUN  --  Cleanup: 짧거나 빈 run_sessions 행 제거
--
-- 배경:
--   run_sessions 스키마의 status 컬럼은 default 'completed'.
--   옛 코드는 러닝 시작 즉시 INSERT했고, 그 결과 default 적용으로
--   status='completed' + total_dist_km=0 + total_time_ms=0 인 stub 행이
--   DB에 박혔다가 retire/완주 시 UPDATE/DELETE되는 구조였음.
--   네트워크 실패, swipe-back, 앱 크래시 등으로 그 cleanup이 누락되면
--   "0km 완료된 세션"이 영구히 남아 통계에 반영됨.
--
--   신규 코드는 시작 시점 INSERT를 하지 않고, 완주 확정 시점에만 INSERT하므로
--   이런 stub 행이 더 이상 생기지 않음. 이 마이그레이션은 일회성 청소.
--
-- 중요: `total_dist_km IS NULL` / `total_time_ms IS NULL` 도 같이 잡아야 함.
-- SQL 3치 논리상 `NULL < 0.10`은 NULL → DELETE에서 제외되기 때문.
-- =============================================================

DELETE FROM public.run_sessions
WHERE total_dist_km IS NULL
   OR total_dist_km < 0.10
   OR total_time_ms IS NULL
   OR total_time_ms < 1000;

-- 검증: 0건 남아있어야 정상
SELECT COUNT(*) AS short_sessions_remaining
FROM public.run_sessions
WHERE total_dist_km IS NULL
   OR total_dist_km < 0.10
   OR total_time_ms IS NULL
   OR total_time_ms < 1000;
