import { createClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// MMKV-backed storage adapter for Supabase Auth session persistence.
// 앱 재시작 시 로그인 유지를 위해 필요.
const authStorage = createMMKV({ id: 'supabase-auth' });

const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    return authStorage.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    authStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    authStorage.remove(key);
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
