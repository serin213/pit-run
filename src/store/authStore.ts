import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/client';

interface AuthState {
  /** null = loading, false = not authenticated */
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  /** 앱 시작 시 세션 복원 */
  initialize: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
      });
    });
  },

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
    }),
}));
