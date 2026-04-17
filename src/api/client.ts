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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
