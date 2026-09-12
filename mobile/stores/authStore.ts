import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import {
  loadStoredTokens,
  persistTokens,
  clearTokens,
  setUnauthorizedHandler,
} from '@/services/api';
import * as authService from '@/services/authService';
import type { User } from '@/types';

export type AuthStatus =
  | 'booting'
  | 'unauthenticated'
  | 'onboarding'
  | 'authenticated'
  | 'error';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  bootError: string | null;
  submitting: boolean;

  bootstrap: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
}

async function resolveStatus(user: User): Promise<AuthStatus> {
  if (!user.companyId) return 'onboarding';
  return 'authenticated';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  user: null,
  bootError: null,
  submitting: false,

  bootstrap: async () => {
    set({ status: 'booting', bootError: null });
    try {
      const { access } = await loadStoredTokens();
      if (!access) {
        set({ status: 'unauthenticated', user: null });
        return;
      }
      const user = await authService.fetchMe();
      set({ user, status: await resolveStatus(user) });
    } catch (err) {
      // Invalid/expired refresh → clean slate. Network issue → let user retry.
      const message = (err as any)?.response?.status
        ? null
        : 'Could not reach the server. Check your internet connection.';
      if ((err as any)?.response?.status === 401) {
        await clearTokens();
        set({ status: 'unauthenticated', user: null });
        return;
      }
      set({
        status: message ? 'error' : 'unauthenticated',
        bootError: message ?? null,
      });
      if (!message) await clearTokens().catch(() => {});
    }
  },

  retryBootstrap: async () => {
    await get().bootstrap();
  },

  login: async (email, password) => {
    set({ submitting: true });
    try {
      const data = await authService.login(email, password);
      set({ user: data.user, status: await resolveStatus(data.user) });
    } finally {
      set({ submitting: false });
    }
  },

  register: async (input) => {
    set({ submitting: true });
    try {
      const data = await authService.register(input);
      // New users always go through company onboarding.
      set({ user: data.user, status: 'onboarding' });
    } finally {
      set({ submitting: false });
    }
  },

  logout: async () => {
    const refreshToken = await SecureStore.getItemAsync('bt.refreshToken').catch(() => null);
    await authService.logout(refreshToken).catch(() => {});
    set({ status: 'unauthenticated', user: null });
  },

  refreshUser: async () => {
    try {
      const user = await authService.fetchMe();
      set({ user, status: await resolveStatus(user) });
    } catch {
      // keep current state; handled globally by interceptors otherwise
    }
  },

  setUser: (user) => set({ user }),
}));

// API layer tells us when a session is irrecoverably expired.
setUnauthorizedHandler(() => {
  clearTokens().catch(() => {});
  useAuthStore.setState({ status: 'unauthenticated', user: null });
});

export { persistTokens };
