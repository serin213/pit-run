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
import { syncDiag } from '../api/saveDiag';

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
      // FIX 8-3: 각 sync를 개별 try-catch로 분리. 하나 실패해도 나머지 진행.
      // 기존 큰 try-catch는 초기 fetch가 throw하면 모든 후속 sync가 실행 안 됨.

      // ── 0. Pending mutations flush ────────────────────────────────────
      try {
        await flushAllPendingMutations();
        syncDiag.flushOk = true;
        syncDiag.flushErr = '';
      } catch (e) {
        syncDiag.flushOk = false;
        syncDiag.flushErr = String(e).slice(0, 200);
        console.warn('[useSyncOnLogin] flush error:', e);
      }

      // pending 큐 재확인 — 이후 sync에서 사용
      const pendingSessionsAfter = getPendingQueue();
      const pendingQualAfter = getPendingQualifyingQueue();

      // ── 1. Profile sync ───────────────────────────────────────────────
      try {
        const profile = await fetchProfile();
        const current = useAppStore.getState().profile;
        const isDefault =
          current.displayName === 'LEC' &&
          current.raceNumber === '16' &&
          current.nameTagAccentColor === PALETTE.red;

        if (profile && profile.display_name) {
          // FIX 8-4: isDefault gate 제거. DB가 source of truth.
          // MMKV 값에 관계없이 DB의 최신 값으로 sync.
          const pendingProf = getPendingProfile();
          if (!pendingProf) {
            useAppStore.getState().setProfile({
              displayName: profile.display_name,
              raceNumber: profile.race_number || current.raceNumber,
              nameTagAccentColor: profile.accent_color || current.nameTagAccentColor,
            });
          } else {
            console.warn('[useSyncOnLogin] pending profile exists — keeping local');
          }
        } else if (!profile && !isDefault) {
          // DB에 profile 없고 로컬에 사용자 입력 있음 → push
          console.warn('[useSyncOnLogin] remote profile missing — pushing local profile to Supabase');
          try {
            await upsertProfile({
              display_name: current.displayName,
              race_number: current.raceNumber,
              accent_color: current.nameTagAccentColor,
            });
          } catch (e) {
            console.warn('[useSyncOnLogin] profile push failed:', e);
          }
        }
        syncDiag.profileOk = true;
        syncDiag.profileErr = '';
      } catch (e) {
        syncDiag.profileOk = false;
        syncDiag.profileErr = String(e).slice(0, 200);
        console.warn('[useSyncOnLogin] profile sync error:', e);
      }

      // ── 2. Qualifying sync ────────────────────────────────────────────
      try {
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
          useAppStore.getState().setQualifyingResult(null);
        } else {
          console.warn(`[useSyncOnLogin] ${pendingQualAfter.length} pending qualifying — keeping local`);
        }
        syncDiag.qualifyingOk = true;
        syncDiag.qualifyingErr = '';
      } catch (e) {
        syncDiag.qualifyingOk = false;
        syncDiag.qualifyingErr = String(e).slice(0, 200);
        console.warn('[useSyncOnLogin] qualifying sync error:', e);
      }

      // ── 3. Qualifying dates sync ──────────────────────────────────────
      try {
        const qualRows = await fetchQualifyingHistory();
        const dbQualDates = qualRows.map((r) => r.recorded_at.slice(0, 10));
        const pendingQualDates = pendingQualAfter.map((p) => p._queuedAt.slice(0, 10));
        const qualifyingDates = [...new Set([...dbQualDates, ...pendingQualDates])];
        useAppStore.setState({ qualifyingDates });
        syncDiag.qualifyingDatesOk = true;
        syncDiag.qualifyingDatesErr = '';
      } catch (e) {
        syncDiag.qualifyingDatesOk = false;
        syncDiag.qualifyingDatesErr = String(e).slice(0, 200);
        console.warn('[useSyncOnLogin] qualifying dates sync error:', e);
      }

      // ── 4. Activity dates sync ────────────────────────────────────────
      try {
        const remoteDates = await fetchActivityDates();
        const pendingSessionDates = pendingSessionsAfter
          .filter((p) => (p.total_dist_km ?? 0) >= 0.10)
          .map((p) => p.started_at.slice(0, 10));
        const sortedDates = [...new Set([...remoteDates, ...pendingSessionDates])]
          .sort()
          .reverse();
        useAppStore.setState({ activityDates: sortedDates });
        syncDiag.activityDatesOk = true;
        syncDiag.activityDatesErr = '';
      } catch (e) {
        syncDiag.activityDatesOk = false;
        syncDiag.activityDatesErr = String(e).slice(0, 200);
        console.warn('[useSyncOnLogin] activity dates sync error:', e);
      }

      // ── 5. Total distance sync ────────────────────────────────────────
      try {
        const allSessions = await fetchSessions(500);
        const dbKm = allSessions
          .filter((s) => s.status === 'completed' && (s.total_dist_km ?? 0) >= 0.10)
          .reduce((sum, s) => sum + (s.total_dist_km ?? 0), 0);
        const pendingKm = pendingSessionsAfter
          .filter((p) => (p.total_dist_km ?? 0) >= 0.10)
          .reduce((sum, p) => sum + (p.total_dist_km ?? 0), 0);
        useAppStore.setState({ totalDistanceKm: dbKm + pendingKm });
        syncDiag.totalDistanceOk = true;
        syncDiag.totalDistanceErr = '';
      } catch (e) {
        syncDiag.totalDistanceOk = false;
        syncDiag.totalDistanceErr = String(e).slice(0, 200);
        console.warn('[useSyncOnLogin] total distance sync error:', e);
      }

      syncDiag.lastSyncAt = Date.now();
    })();
  }, [isAuthenticated]);
}
