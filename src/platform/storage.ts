/**
 * Platform storage abstraction
 *
 * Native: react-native-mmkv
 * Toss 미니앱: 향후 토스 SDK storage로 교체
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';

let storage: MMKV | null = null;

function getStorage(): MMKV {
  if (!storage) {
    storage = createMMKV({ id: 'pitrun-default' });
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
