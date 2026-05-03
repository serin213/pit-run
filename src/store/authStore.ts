import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/client';
import { setupDeepLinkListener } from '../platform/auth';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  _initialized: boolean;

  /** 앱 시작 시 세션 복원 + deep link listener 등록 */
  initialize: () => Promise<void>;
  setSession: (session: Session | null) => void;
  /** onAuthStateChange 구독 해제 + 재초기화 허용 */
  cleanup: () => void;
}

/** onAuthStateChange 구독 핸들 — 상태가 아닌 사이드이펙트 핸들이므로 모듈 레벨 보관 */
let _authSubscription: { unsubscribe: () => void } | null = null;

/** getSession()이 네트워크 요청으로 멈출 경우를 대비한 타임아웃 래퍼 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  _initialized: false,

  initialize: async () => {
    if (useAuthStore.getState()._initialized) return;
    useAuthStore.setState({ _initialized: true });

    // Deep link listener for Google OAuth callback
    setupDeepLinkListener();

    try {
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        5000, // 5초 내 응답 없으면 비로그인으로 진행
      );
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }

    // 실시간 세션 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
      });
    });
    _authSubscription = subscription;
  },

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
    }),

  cleanup: () => {
    _authSubscription?.unsubscribe();
    _authSubscription = null;
    useAuthStore.setState({ _initialized: false });
  },
}));
