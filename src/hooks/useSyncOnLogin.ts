import { PALETTE } from '../constants/colors';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { fetchLatestQualifying, fetchQualifyingHistory } from '../api/qualifying';
import { fetchActivityDates } from '../api/activity';
import { fetchProfile } from '../api/profiles';
import { fetchSessions } from '../api/sessions';
import { flushPendingEvents } from '../lib/analytics/raceEvents';

/**
 * 로그인 성공 시 Supabase 데이터를 로컬 appStore로 동기화.
 * RootNavigator에서 1회 사용.
 */
export function useSyncOnLogin() {
  const { isAuthenticated } = useAuthStore();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;
    syncedRef.current = true;
    flushPendingEvents().catch(() => {});

    (async () => {
      try {
        // 프로필 동기화
        const profile = await fetchProfile();
        if (profile) {
          const current = useAppStore.getState().profile;
          const isDefault =
            current.displayName === 'LEC' &&
            current.raceNumber === '16' &&
            current.nameTagAccentColor === PALETTE.red;

          // Supabase에 프로필이 있고 로컬이 기본값이면 Supabase 우선
          if (profile.display_name && isDefault) {
            useAppStore.getState().setProfile({
              displayName: profile.display_name,
              raceNumber: profile.race_number || current.raceNumber,
              nameTagAccentColor: profile.accent_color || current.nameTagAccentColor,
            });
          }
        }

        // 퀄리파잉 동기화 — DB가 source-of-truth.
        // 이전엔 `&& !state.qualifyingResult` 가드로 "로컬에 있으면 안 덮어씀" 정책이라,
        // DB에서 cleanup된 경우(다른 디바이스 삭제 / SQL 마이그레이션 등) 로컬에
        // stale qualifyingResult가 영구히 남아 마이페이지/히스토리에 등급 트로피가
        // 표시되고 RaceScreen의 `if (!qualifyingResult)` 가드를 우회하는 버그.
        // qualifyingDates와 동일하게 DB 결과를 무조건 반영 — 비어있으면 로컬도 null.
        const qualifying = await fetchLatestQualifying();
        if (qualifying) {
          useAppStore.getState().setQualifyingResult({
            warmupMinutes: qualifying.warmup_minutes,
            oneKmMs: qualifying.one_km_ms,
            paceSecPerKm: qualifying.pace_sec_per_km,
            grade: qualifying.grade,
            nextIntervalHint: '', // 서버에서는 hint 미저장, 로컬 재생성 필요 시 core 사용
          });
        } else {
          useAppStore.getState().setQualifyingResult(null);
        }

        // 퀄리파잉 날짜 동기화 — DB가 source-of-truth.
        // DB가 비어있어도 (cleanup 직후) 로컬을 비워줘야 stale 잔재가 안 남음.
        const qualRows = await fetchQualifyingHistory();
        const qualifyingDates = qualRows.map((r) => r.recorded_at.slice(0, 10));
        useAppStore.setState({ qualifyingDates });

        // 활동 날짜 동기화 — 동일하게 DB로 덮어씀. MERGE 금지.
        // (옛 코드: local과 remote를 merge → DB에서 지운 행이 로컬에 stale로 남음)
        const remoteDates = await fetchActivityDates();
        const sortedDates = [...new Set(remoteDates)].sort().reverse();
        useAppStore.setState({ activityDates: sortedDates });

        // 누적 거리 동기화 — DB의 모든 completed 세션 거리 합으로 덮어씀.
        // Zustand 영속값(addDistance로 누적)이 옛 stale 합계로 남는 문제 방어.
        // qualifying(1km)도 포함 — TOTAL 스탯은 grand_prix + qualifying 합산이 맞는 정책.
        // (월간 거리 thisMonthDistKm는 grand_prix만 집계하지만, 통산 TOTAL은 모든 완주 포함)
        try {
          const allSessions = await fetchSessions(500);
          const totalKm = allSessions
            .filter((s) => s.status === 'completed' && (s.type === 'grand_prix' || s.type === 'qualifying') && (s.total_dist_km ?? 0) >= 0.10)
            .reduce((sum, s) => sum + (s.total_dist_km ?? 0), 0);
          useAppStore.setState({ totalDistanceKm: totalKm });
        } catch {
          // 실패 시 기존 값 유지 — 다음 로그인 시점에 다시 시도
        }
      } catch (e) {
        console.warn('[useSyncOnLogin] sync error:', e);
      }
    })();
  }, [isAuthenticated]);
}
