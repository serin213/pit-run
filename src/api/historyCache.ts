/**
 * History fetch 캐시 — 세션 + 퀄리파잉 공용.
 *
 * 별도 모듈로 추출한 이유:
 *   - hooks(useSessionHistory)가 모듈 캐시를 가지면 pendingFlush 같은 api 레이어
 *     함수가 invalidate 호출할 때 hooks → api 단방향이 깨짐 (layering violation).
 *   - api/historyCache로 빼면 양쪽 레이어가 동일 cache 모듈을 의존. hook은 자기
 *     state를 캐시로 부트스트랩하기 위해, api(pendingFlush)/api(useSupabase*)는
 *     invalidate를 호출하기 위해.
 *
 * 키 전략:
 *   - userId로 key. 다른 계정 로그인 시 자동 miss.
 *   - 단일 entry만 유지 (가장 최근에 본 user). 동시 multi-user 시나리오는 없음.
 *
 * TTL:
 *   - Stale-while-revalidate 패턴이라 30초는 "네트워크 생략 가능"의 임계값.
 *   - 30초 지나면 캐시는 즉시 표시되지만 백그라운드 fetch도 같이 일어남.
 */

import type { SessionRow } from './sessions';
import type { QualifyingRow } from './qualifying';

export const HISTORY_FETCH_TTL_MS = 30_000;

export type CachedSessions = {
  userId: string;
  data: SessionRow[];
  fetchedAt: number;
};

export type CachedQualifying = {
  userId: string;
  data: QualifyingRow[];
  fetchedAt: number;
};

let _sessions: CachedSessions | null = null;
let _qualifying: CachedQualifying | null = null;

export function getSessionsCache(): CachedSessions | null {
  return _sessions;
}

export function setSessionsCache(userId: string, data: SessionRow[]): void {
  _sessions = { userId, data, fetchedAt: Date.now() };
}

export function invalidateSessionsCache(): void {
  _sessions = null;
}

export function getQualifyingCache(): CachedQualifying | null {
  return _qualifying;
}

export function setQualifyingCache(userId: string, data: QualifyingRow[]): void {
  _qualifying = { userId, data, fetchedAt: Date.now() };
}

export function invalidateQualifyingCache(): void {
  _qualifying = null;
}
