import { PALETTE } from '../constants/colors';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { fetchLatestQualifying, fetchQualifyingHistory } from '../api/qualifying';
import { fetchActivityDates } from '../api/activity';
import { fetchProfile, upsertProfile } from '../api/profiles';
import { fetchSessions } from '../api/sessions';
import { flushAllPendingMutations } from '../api/pendingFlush';
import { getPendingQueue } from '../api/pendingSessions';
import {
  getPendingQualifyingQueue,
  getPendingProfile,
} from '../api/pendingMutations';
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
        // ⚠️ 순서가 중요: pending flush를 fetch 전에 먼저 실행.
        // 이유 — 직전 launch에서 저장이 큐에 적재되었다면, fetch를 먼저 할 경우
        // DB가 비어있어 로컬을 0/[]로 덮어씀 → 그 후 flush해도 totalKm은 다음 launch
        // 까지 stale. 큐 flush 선행 → DB가 즉시 반영되어 후속 fetch가 올바른 값을 가져옴.
        //
        // flush 로직은 api/pendingFlush.ts로 분리 — AppState 'active' 트리거 등 다른
        // 시점에서도 동일 코드 재사용 (usePendingFlushTriggers).
        await flushAllPendingMutations();

        // 프로필 동기화 — 양방향:
        //   (1) remote 있고 local이 default → local에 remote 반영
        //   (2) remote 없고 local이 non-default → local을 remote에 push
        //       (ProfileSetup 시점 save가 silent fail로 사라진 케이스 복구 — 사용자 명시 버그)
        const profile = await fetchProfile();
        const current = useAppStore.getState().profile;
        const isDefault =
          current.displayName === 'LEC' &&
          current.raceNumber === '16' &&
          current.nameTagAccentColor === PALETTE.red;

        if (profile && profile.display_name && isDefault) {
          // (1) remote → local
          useAppStore.getState().setProfile({
            displayName: profile.display_name,
            raceNumber: profile.race_number || current.raceNumber,
            nameTagAccentColor: profile.accent_color || current.nameTagAccentColor,
          });
        } else if (!profile && !isDefault) {
          // (2) local → remote. ProfileSetup의 save()가 !isAuthenticated이나 네트워크
          // 오류로 silent drop된 경우 로컬엔 사용자가 입력한 값이 있는데 Supabase엔
          // 행 자체가 없음 → 다음 launch에서 이 경로로 자동 복구.
          console.warn('[useSyncOnLogin] remote profile missing — pushing local profile to Supabase');
          try {
            await upsertProfile({
              display_name: current.displayName,
              race_number: current.raceNumber,
              accent_color: current.nameTagAccentColor,
            });
          } catch (e) {
            console.warn('[useSyncOnLogin] profile push failed (will retry on next launch):', e);
          }
        }

        // flush 시도 후에도 큐에 남아있는지 재확인 — 남아있으면 "아직 미동기 데이터"가
        // 있다는 뜻이라 로컬을 DB로 덮어쓰면 안 됨 (사용자 race 결과가 사라짐).
        const pendingSessionsAfter = getPendingQueue();
        const pendingQualAfter = getPendingQualifyingQueue();
        const pendingProfileAfter = getPendingProfile();

        // 퀄리파잉 동기화 — DB가 source-of-truth, 단 pending이 있으면 로컬 보존.
        const qualifying = await fetchLatestQualifying();
        if (qualifying) {
          useAppStore.getState().setQualifyingResult({
            warmupMinutes: qualifying.warmup_minutes,
            oneKmMs: qualifying.one_km_ms,
            paceSecPerKm: qualifying.pace_sec_per_km,
            grade: qualifying.grade,
            nextIntervalHint: '',
          });
        } else if (pendingQualAfter.length === 0) {
          // DB 비어있고 pending도 없음 → 정말 비어있음 (다른 디바이스 삭제 등)
          useAppStore.getState().setQualifyingResult(null);
        } else {
          // pending 있음 → 로컬 보존 (사용자 race 결과 사라지지 않게)
          console.warn(`[useSyncOnLogin] ${pendingQualAfter.length} pending qualifying — keeping local`);
        }

        // 퀄리파잉 날짜 동기화 — DB + pending qualifying 날짜 머지.
        const qualRows = await fetchQualifyingHistory();
        const dbQualDates = qualRows.map((r) => r.recorded_at.slice(0, 10));
        const pendingQualDates = pendingQualAfter.map((p) => p._queuedAt.slice(0, 10));
        const qualifyingDates = [...new Set([...dbQualDates, ...pendingQualDates])];
        useAppStore.setState({ qualifyingDates });

        // 활동 날짜 동기화 — DB + pending session 날짜 머지.
        // (pending session도 사용자 활동한 날이므로 캘린더 dot 표시해야 함)
        const remoteDates = await fetchActivityDates();
        const pendingSessionDates = pendingSessionsAfter
          .filter((p) => (p.total_dist_km ?? 0) >= 0.10)
          .map((p) => p.started_at.slice(0, 10));
        const sortedDates = [...new Set([...remoteDates, ...pendingSessionDates])]
          .sort()
          .reverse();
        useAppStore.setState({ activityDates: sortedDates });

        // 누적 거리 동기화 — DB 세션 + pending 세션 합산. dist >= 0.10 동일 기준.
        // pending이 있을 때 로컬이 wipe되어 0으로 떨어지는 사용자 보고 버그 fix.
        try {
          const allSessions = await fetchSessions(500);
          const dbKm = allSessions
            .filter((s) => s.status === 'completed' && (s.total_dist_km ?? 0) >= 0.10)
            .reduce((sum, s) => sum + (s.total_dist_km ?? 0), 0);
          const pendingKm = pendingSessionsAfter
            .filter((p) => (p.total_dist_km ?? 0) >= 0.10)
            .reduce((sum, p) => sum + (p.total_dist_km ?? 0), 0);
          useAppStore.setState({ totalDistanceKm: dbKm + pendingKm });
        } catch {
          // 실패 시 기존 값 유지
        }

        // 프로필 pending이 있어도 로컬은 이미 setProfile로 반영되어 있음 (ProfileSetup
        // 시점에). flush가 다음 launch에서 처리. 별도 액션 불필요.
        void pendingProfileAfter;
      } catch (e) {
        console.warn('[useSyncOnLogin] sync error:', e);
      }
    })();
  }, [isAuthenticated]);
}
