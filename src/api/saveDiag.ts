/**
 * Save diagnostic — 모든 mutation API의 attempts / errors / success를 module-level
 * mutable 객체에 기록. QualifyingScreen 등에서 overlay로 표시해 실기기에서
 * "왜 INSERT 실패했는지" 즉시 식별.
 *
 * 사용 패턴 (mutation 함수 안에서):
 *   recordSaveAttempt('run_sessions');
 *   try {
 *     const data = await insert(...);
 *     recordSaveSuccess('run_sessions');
 *     return data;
 *   } catch (e) {
 *     recordSaveError('run_sessions', e);
 *     throw e;
 *   }
 *
 * Overlay 표시 전엔 refreshSaveDiagCounts()를 호출해 pending queue 사이즈 갱신.
 */

import { getPendingQueue } from './pendingSessions';
import { getPendingQualifyingQueue, getPendingProfile } from './pendingMutations';

export const syncDiag = {
  profileOk: false,
  profileErr: '',
  qualifyingOk: false,
  qualifyingErr: '',
  qualifyingDatesOk: false,
  qualifyingDatesErr: '',
  activityDatesOk: false,
  activityDatesErr: '',
  totalDistanceOk: false,
  totalDistanceErr: '',
  flushOk: false,
  flushErr: '',
  lastSyncAt: 0,
};

export const saveDiag = {
  /** 마지막 mutation 시도 시점의 인증 상태 */
  isAuth: false,
  /** 마지막 mutation 시도 시점의 user_id 앞 8자 (전체 노출 방지) */
  authUid: '',
  /** Pending queue 사이즈 */
  pendingSessions: 0,
  pendingQual: 0,
  pendingProfile: false,
  /** 누적 시도 / 성공 카운트 */
  attemptsTotal: 0,
  successTotal: 0,
  /** 마지막 에러 정보 */
  lastErrTable: '',
  lastErrCode: '',
  lastErrMsg: '',
  lastErrAtSec: 0,
  /** 마지막 성공 정보 */
  lastSuccessTable: '',
  lastSuccessAtSec: 0,
};

export function recordSaveAttempt(_table: string): void {
  saveDiag.attemptsTotal++;
}

export function recordSaveSuccess(table: string): void {
  saveDiag.successTotal++;
  saveDiag.lastSuccessTable = table;
  saveDiag.lastSuccessAtSec = Math.floor(Date.now() / 1000);
  // 성공 시점에 마지막 에러 메시지는 그대로 유지 — 과거 에러 진단 정보 보존.
}

export function recordSaveError(table: string, err: any): void {
  saveDiag.lastErrTable = table;
  const code = err?.code ?? err?.status ?? '';
  saveDiag.lastErrCode = String(code).slice(0, 16) || 'no-code';
  saveDiag.lastErrMsg = String(err?.message ?? err ?? 'unknown').slice(0, 100);
  saveDiag.lastErrAtSec = Math.floor(Date.now() / 1000);
}

export function recordAuthState(session: { user?: { id?: string } } | null | undefined): void {
  saveDiag.isAuth = !!session;
  saveDiag.authUid = session?.user?.id ? session.user.id.slice(0, 8) : '';
}

/** Pending queue 카운트 갱신 — overlay 표시 전 호출. */
export function refreshSaveDiagCounts(): void {
  saveDiag.pendingSessions = getPendingQueue().length;
  saveDiag.pendingQual = getPendingQualifyingQueue().length;
  saveDiag.pendingProfile = !!getPendingProfile();
}
