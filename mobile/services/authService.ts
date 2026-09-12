import { api, cachedGet, persistTokens, clearTokens } from './api';
import type { ApiResponse } from '@/types';

export interface AuthPayload {
  user: import('@/types').User;
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const res = await api.post<ApiResponse<AuthPayload>>('/auth/login', { email, password });
  await persistTokens(res.data.data.accessToken, res.data.data.refreshToken);
  return res.data.data;
}

export async function register(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthPayload> {
  const res = await api.post<ApiResponse<AuthPayload>>('/auth/register', input);
  await persistTokens(res.data.data.accessToken, res.data.data.refreshToken);
  return res.data.data;
}

export async function fetchMe() {
  const res = await api.get<ApiResponse<import('@/types').User>>('/auth/me');
  return res.data.data;
}

export async function logout(refreshToken: string | null) {
  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } finally {
    await clearTokens();
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await api.put<ApiResponse<null>>('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return res.data.message;
}

export async function updateProfile(input: { name?: string; phone?: string }) {
  const res = await api.patch<ApiResponse<import('@/types').User>>('/auth/profile', input);
  return res.data.data;
}

export { cachedGet };

// Namespace-style export used by screens: authService.login(...) etc.
export const authService = {
  login,
  register,
  fetchMe,
  logout,
  changePassword,
  updateProfile,
};
