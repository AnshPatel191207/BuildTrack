import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useNetworkStore } from '@/stores/networkStore';
import type { ApiResponse } from '@/types';

/**
 * Dev convenience: when no explicit API URL is configured, derive it from the
 * machine serving the JS bundle (Metro), so the phone hits the same PC over
 * Wi-Fi even after its DHCP address changes. Only used for plain LAN IPs —
 * never for localhost or expo tunnel hosts.
 */
function resolveDevApiUrl(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    ((Constants as unknown as { expoGoConfig?: { developer?: { host?: string } } }).expoGoConfig?.developer?.host ?? null);
  const host = hostUri?.split(':')[0];
  if (!host || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return null;
  }
  return `http://${host}:5000/api`;
}

function isAndroidEmulator(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes('Android') && navigator.userAgent.includes('wv');
}

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  resolveDevApiUrl() ??
  (isAndroidEmulator() ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api');

/** Origin without the /api suffix — used to resolve relative image URLs. */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

const ACCESS_TOKEN_KEY = 'bt.accessToken';
const REFRESH_TOKEN_KEY = 'bt.refreshToken';

let accessToken: string | null = null;

export async function loadStoredTokens(): Promise<{ access: string | null; refresh: string | null }> {
  try {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    accessToken = access;
    return { access, refresh };
  } catch {
    return { access: null, refresh: null };
  }
}

export async function persistTokens(access: string, refresh: string): Promise<void> {
  accessToken = access;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
}

/** Registered by authStore so the API layer can force a clean logout. */
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.set?.('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// ── Single-flight token refresh ──────────────────────────────────

interface RetryConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Auth endpoints where a 401 means the presented credential is simply wrong
 * (bad password, revoked/rotated refresh token) — retrying via /auth/refresh
 * would be pointless. NOTE: /auth/me must NOT be in this list, or sessions
 * can never be restored from an expired access token at app start.
 */
const NO_REFRESH_PATHS = /\/auth\/(login|register|refresh|logout)(\?|$)/;

async function requestNewAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 15_000 },
    );
    const data = res.data?.data;
    if (!data?.accessToken) return null;
    accessToken = data.accessToken;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !(original.url && NO_REFRESH_PATHS.test(original.url))
    ) {
      original._retry = true;
      refreshPromise = refreshPromise ?? requestNewAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      unauthorizedHandler?.();
    }

    // Track connectivity for the offline banner.
    if (isConnectionError(error)) {
      useNetworkStore.getState().setOnline(false);
    }

    throw error;
  },
);

export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    error.message === 'Network Error'
  );
}

// ── Offline write queue ───────────────────────────────────────────

/** Thrown when a mutation was queued locally instead of being sent. */
export class OfflineQueuedError extends Error {
  constructor(label: string) {
    super(
      label
        ? `${label} saved offline — it will sync automatically once you're back online.`
        : 'Saved offline — it will sync automatically once you are back online.',
    );
    this.name = 'OfflineQueuedError';
  }
}

/**
 * Mutation wrapper with automatic offline queueing. Sends the request; if the
 * device is offline, stores it in the SQLite outbox and throws
 * OfflineQueuedError so screens can show the "saved offline" toast.
 * The outbox is flushed by syncStore when connectivity returns.
 */
export async function mutateWithOfflineQueue<T>(
  config: AxiosRequestConfig & { method: 'POST' | 'PUT' | 'DELETE'; url: string },
  label: string,
): Promise<T> {
  try {
    const res = await api.request<ApiResponse<T>>(config);
    return (res.data as any)?.data !== undefined ? (res.data as any).data : (res.data as T);
  } catch (err) {
    if (isConnectionError(err)) {
      const { enqueueMutation } = await import('@/lib/offline');
      await enqueueMutation({
        method: config.method,
        url: config.url,
        body: config.data ?? null,
        label,
      });
      throw new OfflineQueuedError(label);
    }
    throw err;
  }
}

/**
 * Human-friendly error messages. Never surface raw axios errors to users.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof OfflineQueuedError) return error.message;
  if (error instanceof AxiosError) {
    if (isConnectionError(error)) {
      return "You're offline. Check your internet connection and try again.";
    }
    if (error.code === 'ECONNABORTED') {
      return 'The server took too long to respond. Please try again.';
    }
    const data = error.response?.data as
      | { message?: string; errors?: { field?: string; message: string }[] }
      | undefined;
    // Validation failures: lead with the specific field problem so users can
    // self-correct instead of retrying blind.
    const firstError = data?.errors?.[0];
    if (firstError) {
      const fieldLabel = firstError.field
        ? firstError.field.replace(/[_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : '';
      return fieldLabel ? `${fieldLabel}: ${firstError.message}` : firstError.message;
    }
    if (data?.message) return data.message;
    if (error.response?.status === 429) {
      return 'Too many attempts. Please wait a few minutes.';
    }
    if (error.response && error.response.status >= 500) {
      return 'Our server had a hiccup. Please try again in a moment.';
    }
  }
  return fallback;
}

// ── Offline GET cache (stale-while-revalidate) ────────────────────

const CACHE_PREFIX = 'bt.cache.';

function cacheKey(url: string, params?: Record<string, unknown>): string {
  return `${CACHE_PREFIX}${url}?${params ? JSON.stringify(params) : ''}`;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw).d as T) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    // Storage full etc — caching is best-effort.
  }
}

/**
 * GET with offline fallback: on network failure, returns the last cached
 * payload so users can still browse recent data at the site.
 */
export async function cachedGet<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const key = cacheKey(url, params);
  try {
    const res = await api.get<unknown>(url, { params });
    const payload =
      (res.data as any)?.data !== undefined ? (res.data as any).data : res.data;
    void writeCache(key, payload);
    return payload as T;
  } catch (err) {
    if (isConnectionError(err)) {
      const cached = await readCache<T>(key);
      if (cached != null) return cached;
    }
    throw err;
  }
}
