import { useEffect, useState } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { useAuthStore } from '../store/authStore';

const TESTER_EMAILS = [
  'renajang0213@gmail.com',
  'rena0213@naver.com',
  'zhrv6jvdkt@privaterelay.appleid.com',
];

// Lazy init: New Architecture에서 native module이 모듈 로드 시점에 준비되지 않을 수 있음.
let _store: ReturnType<typeof createMMKV> | null = null;
function getStore() {
  if (!_store) _store = createMMKV({ id: 'devmode' });
  return _store;
}
function safeGetBool(): boolean {
  try {
    return getStore().getBoolean(KEY) ?? false;
  } catch {
    return false;
  }
}
function safeSetBool(value: boolean): void {
  try {
    getStore().set(KEY, value);
  } catch {
    // ignore
  }
}

const KEY = 'on';

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function isTesterEmail(email: string | null | undefined): boolean {
  return !!email && TESTER_EMAILS.includes(email.toLowerCase());
}

export function useDevMode() {
  const email = useAuthStore((s) => s.user?.email ?? null);
  const isTester = isTesterEmail(email);
  const [isOn, setOn] = useState(safeGetBool);

  useEffect(() => {
    const listener = () => setOn(safeGetBool());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    isDevMode: __DEV__ || (isTester && isOn),
    isTester,
    toggle: () => {
      if (!isTester) return;
      const next = !safeGetBool();
      safeSetBool(next);
      notify();
    },
  };
}
