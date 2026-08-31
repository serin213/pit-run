/**
 * Platform storage abstraction
 *
 * Native: react-native-mmkv
 * Toss 미니앱: 향후 토스 SDK storage로 교체
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';

const DEFAULT_STORAGE_ID = 'pitrun-default';
const ALL_STORAGE_IDS = [
  DEFAULT_STORAGE_ID,
  'app-store',
  'supabase-auth',
  'devmode',
] as const;

let storage: MMKV | null = null;

function getStorage(): MMKV {
  if (!storage) {
    storage = createMMKV({ id: DEFAULT_STORAGE_ID });
  }
  return storage;
}

export function getString(key: string): string | undefined {
  return getStorage().getString(key);
}

export function setString(key: string, value: string): void {
  getStorage().set(key, value);
}

export function getBoolean(key: string): boolean {
  return getStorage().getBoolean(key) ?? false;
}

export function setBoolean(key: string, value: boolean): void {
  getStorage().set(key, value);
}

export function remove(key: string): void {
  getStorage().remove(key);
}

export function clearAll(): void {
  getStorage().clearAll();
}

/**
 * 모든 로컬 저장소 데이터 삭제. 계정 삭제 시 호출.
 */
export function clearAllStorage(): void {
  for (const id of ALL_STORAGE_IDS) {
    try {
      const store = id === DEFAULT_STORAGE_ID ? getStorage() : createMMKV({ id });
      store.clearAll();
    } catch {
      // Best-effort cleanup. Individual MMKV init failures should not block logout UX.
    }
  }
}
