import { createClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// MMKV-backed storage adapter for Supabase Auth session persistence.
// Lazy init: New Architecture에서 native module이 모듈 로드 시점에 준비되지 않을 수 있어,
// 첫 접근까지 초기화 지연 + try/catch로 silent fail 방지.
let _authStorage: ReturnType<typeof createMMKV> | null = null;
function getAuthStorage() {
  if (!_authStorage) _authStorage = createMMKV({ id: 'supabase-auth' });
  return _authStorage;
}

const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      return getAuthStorage().getString(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      getAuthStorage().set(key, value);
    } catch {
      // ignore — session 저장 실패는 다음 로그인 시 재시도
    }
  },
  removeItem: (key: string): void => {
    try {
      getAuthStorage().remove(key);
    } catch {
      // ignore
    }
  },
};

/** 네트워크 오류 시 최대 2회 재시도. auth/not-found 에러는 즉시 throw. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLastAttempt = i === attempts - 1;
      // auth 오류나 Postgres 에러는 재시도해도 의미 없음
      if (isLastAttempt || err?.code?.startsWith('PG') || err?.status === 401 || err?.status === 403) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
