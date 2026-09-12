import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useSyncStore } from '@/stores/syncStore';
import type { User } from '@/types';

/**
 * Facade over the auth store for screens that only need identity +
 * session actions (never the raw store shape).
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const submitting = useAuthStore((s) => s.submitting);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const setUser = useAuthStore((s) => s.setUser);

  return {
    user: user as User | null,
    status,
    isAuthenticated: status === 'authenticated',
    isOnboarding: status === 'onboarding',
    submitting,
    login,
    register,
    logout,
    refreshUser,
    setUser,
  };
}

/** Convenience selector for the company id used by nearly every query. */
export function useCompanyId(): string | null {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => {
    if (!user?.companyId) return null;
    return typeof user.companyId === 'string' ? user.companyId : user.companyId._id;
  }, [user]);
}

/**
 * Global connectivity + sync orchestration.
 * - Mirrors `isOnline` from the network store.
 * - Toasts "back online" after an outage.
 * - Flushes queued offline writes when a connection returns or the app starts online.
 */
export function useNetworkStatus() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const reconnectCount = useNetworkStore((s) => s.reconnectCount);
  const flushOutbox = useSyncStore((s) => s.flushOutbox);

  useEffect(() => {
    useSyncStore.getState().refreshCount();
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    void flushOutbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectCount, isOnline]);

  const onReconnect = useCallback(() => {}, []);

  return { isOnline, reconnectCount, flushOutbox, onReconnect };
}
