import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '@/services/api';
import type { Pagination } from '@/types';

export interface PagedPage<T> {
  items: T[];
  pagination: Pagination;
}

/**
 * Generic infinite-scroll engine for paginated lists.
 * - `loadMore` fetches the next page and appends.
 * - `refresh` reloads page 1 (pull-to-refresh) and resets state.
 * - Changing `deps` (e.g. a debounced search term) resets the list.
 */
export function usePagination<T>(
  fetchPage: (page: number) => Promise<PagedPage<T>>,
  deps: unknown[] = [],
  options: { limit?: number; enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const fetcherRef = useRef(fetchPage);
  fetcherRef.current = fetchPage;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadInitial = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(1);
      if (!mounted.current) return;
      pageRef.current = 1;
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      if (mounted.current) setError(getApiErrorMessage(err));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInitial, ...deps]);

  const hasMore = pagination ? pagination.page < pagination.totalPages : false;

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const result = await fetcherRef.current(nextPage);
      if (!mounted.current) return;
      pageRef.current = nextPage;
      setPagination(result.pagination);
      setItems((prev) => {
        const seen = new Set(prev.map((i: any) => i?._id ?? JSON.stringify(i)));
        const fresh = result.items.filter((i: any) => !seen.has(i?._id ?? JSON.stringify(i)));
        return [...prev, ...fresh];
      });
    } catch {
      // Endless-scroll failures are non-fatal; user can pull to refresh.
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [enabled, hasMore, loading, loadingMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
  }, [loadInitial]);

  return {
    items,
    setItems,
    pagination,
    loading,
    refreshing,
    error,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
    reload: loadInitial,
  };
}
