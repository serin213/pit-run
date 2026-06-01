import { PALETTE } from '../constants/colors';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { fetchLatestQualifying, fetchQualifyingHistory } from '../api/qualifying';
import { fetchActivityDates } from '../api/activity';
import { fetchProfile, upsertProfile } from '../api/profiles';
import { fetchSessions, insertCompletedSession } from '../api/sessions';
import { getPendingQueue, removePendingSession } from '../api/pendingSessions';
import { recordActivityToday } from '../api/activity';
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
        // ⚠️ 순서가 중요: pending session flush를 fetch 전에 먼저 실행.
        // 이유 — 직전 launch에서 race 저장이 !isAuthenticated으로 큐에 적재되었다고
        // 가정. 만약 fetch를 먼저 하면 DB는 아직 비어있어 useSyncOnLogin이 로컬
        // totalDistanceKm/activityDates를 0/[]로 덮어씀 → 그 후 flush해도 totalKm은
        // 다음 launch까지 stale. flush를 선행하면 DB가 즉시 반영되어 후속 fetch가
        // 올바른 값을 가져옴.
        const queue = getPendingQueue();
        if (queue.length > 0) {
          console.warn(`[useSyncOnLogin] flushing ${queue.length} pending session(s) before sync`);
          for (const pending of queue) {
            const { _queuedAt, ...fields } = pending;
            try {
              await insertCompletedSession(fields);
              removePendingSession(_queuedAt);
              recordActivityToday().catch(() => {});
            } catch (e) {
              console.warn(`[useSyncOnLogin] flush still failing for ${fields.started_at}:`, e);
              // 큐에 유지 — 다음 launch에서 재시도
            }
          }
        }

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
        // grand_prix + qualifying + practice 모두 포함.
        // (history에 기록되는 조건: dist >= 0.10 — 동일 기준 적용)
        try {
          const allSessions = await fetchSessions(500);
          const totalKm = allSessions
            .filter((s) => s.status === 'completed' && (s.total_dist_km ?? 0) >= 0.10)
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
