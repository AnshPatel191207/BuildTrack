import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage, isConnectionError } from '@/services/api';

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  offlineData: boolean;
}

/**
 * Minimal data-fetching hook with pull-to-refresh support.
 * - `loading` is true only for the initial fetch (skeletons).
 * - `refreshing` powers RefreshControl.
 * - Failures surface a retryable error state instead of crashing.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    loading: enabled,
    error: null,
    offlineData: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'silent') => {
      if (!enabled) return;
      if (mode === 'initial') setState((s) => ({ ...s, loading: s.data == null, error: null }));
      try {
        const data = await fetcherRef.current();
        if (mounted.current) setState({ data, loading: false, error: null, offlineData: false });
      } catch (err) {
        if (mounted.current) {
          setState((s) => ({
            ...s,
            loading: false,
            error:
              getApiErrorMessage(err) ??
              (isConnectionError(err)
                ? "You're offline. Showing cached data where available."
                : undefined) ??
              'Something went wrong. Please try again.',
            offlineData: isConnectionError(err),
          }));
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    void load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load('silent').catch(() => {});
    setRefreshing(false);
  }, [load]);

  return {
    ...state,
    refreshing,
    refresh,
    reload: () => load('initial'),
    setData: (data: T | null) => setState((s) => ({ ...s, data })),
  };
}
