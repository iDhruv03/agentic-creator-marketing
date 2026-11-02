import { create } from 'zustand';
import { api, tokenStore } from '@/lib/api';
import type { Me, User } from '@/types';

interface AuthState {
  token: string | null;
  me: Me | null;
  status: 'idle' | 'loading' | 'ready' | 'anonymous';
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  token: tokenStore.get(),
  me: null,
  status: 'idle',

  bootstrap: async () => {
    const token = tokenStore.get();
    if (!token) { set({ status: 'anonymous', me: null, token: null }); return; }
    set({ status: 'loading', token });
    try {
      const me = await api.auth.me();
      set({ me, status: 'ready' });
    } catch {
      tokenStore.set(null);
      set({ token: null, me: null, status: 'anonymous' });
    }
  },

  login: async (email, password) => {
    const { token, user } = await api.auth.login(email, password);
    tokenStore.set(token);
    set({ token, status: 'loading' });
    const me = await api.auth.me();
    set({ me, status: 'ready' });
    return user;
  },

  logout: () => {
    tokenStore.set(null);
    set({ token: null, me: null, status: 'anonymous' });
  },

  refresh: async () => {
    if (!get().token) return;
    try { set({ me: await api.auth.me() }); } catch { /* keep */ }
  },
}));

window.addEventListener('cmi:unauthenticated', () => {
  if (useAuth.getState().status !== 'anonymous') useAuth.getState().logout();
});

export function useUser(): User | null {
  return useAuth((s) => s.me?.user ?? null);
}

export function homeFor(role: User['role'] | undefined): string {
  if (role === 'CREATOR') return '/creator';
  if (role === 'AGENCY') return '/agency';
  return '/';
}
