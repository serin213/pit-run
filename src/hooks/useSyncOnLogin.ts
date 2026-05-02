import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { fetchLatestQualifying, fetchQualifyingHistory } from '../api/qualifying';
import { fetchActivityDates } from '../api/activity';
import { fetchProfile } from '../api/profiles';

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

    (async () => {
      try {
        // 프로필 동기화
        const profile = await fetchProfile();
        if (profile) {
          const current = useAppStore.getState().profile;
          const isDefault =
            current.displayName === 'LEC' &&
            current.raceNumber === '16' &&
            current.nameTagAccentColor === '#E03A3E';

          // Supabase에 프로필이 있고 로컬이 기본값이면 Supabase 우선
          if (profile.display_name && isDefault) {
            useAppStore.getState().setProfile({
              displayName: profile.display_name,
              raceNumber: profile.race_number || current.raceNumber,
              nameTagAccentColor: profile.accent_color || current.nameTagAccentColor,
            });
          }
        }

        // 퀄리파잉 동기화
        const qualifying = await fetchLatestQualifying();
        if (qualifying && !useAppStore.getState().qualifyingResult) {
          useAppStore.getState().setQualifyingResult({
            warmupMinutes: qualifying.warmup_minutes,
            oneKmMs: qualifying.one_km_ms,
            paceSecPerKm: qualifying.pace_sec_per_km,
            grade: qualifying.grade,
            nextIntervalHint: '', // 서버에서는 hint 미저장, 로컬 재생성 필요 시 core 사용
          });
        }

        // 퀄리파잉 날짜 동기화
        const qualRows = await fetchQualifyingHistory();
        if (qualRows.length > 0) {
          const qualifyingDates = qualRows.map((r) => r.recorded_at.slice(0, 10));
          useAppStore.setState({ qualifyingDates });
        }

        // 활동 날짜 동기화
        const remoteDates = await fetchActivityDates();
        if (remoteDates.length > 0) {
          const localDates = useAppStore.getState().activityDates;
          const merged = [...new Set([...localDates, ...remoteDates])].sort().reverse();
          if (merged.length > localDates.length) {
            // Direct set without triggering individual persist for each date
            useAppStore.setState({ activityDates: merged });
          }
        }
      } catch (e) {
        console.warn('[useSyncOnLogin] sync error:', e);
      }
    })();
  }, [isAuthenticated]);
}
