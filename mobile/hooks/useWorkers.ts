import { useCallback } from 'react';
import { workerService } from '@/services/workerService';
import { DATA_KEYS, useDataVersionKey } from '@/stores/dataVersion';
import { useDebouncedValue } from './useDebounce';
import { usePagination } from './usePagination';
import type { WorkerStatus, WorkerType } from '@/types';

/**
 * Paginated worker directory with debounced server-side search
 * (name / phone / skill) and type/status filters.
 */
export function useWorkers(
  options: {
    search?: string;
    workerType?: WorkerType | '';
    status?: WorkerStatus | '';
    projectId?: string | null;
  } = {},
) {
  const search = useDebouncedValue(options.search ?? '', 350);
  const version = useDataVersionKey(DATA_KEYS.workers);

  const fetchPage = useCallback(
    (page: number) =>
      workerService.listWorkers({
        search: search || undefined,
        workerType: options.workerType,
        status: options.status,
        projectId: options.projectId,
        page,
        limit: 20,
      }),
    [search, options.workerType, options.status, options.projectId],
  );

  const list = usePagination(fetchPage, [version, search, options.workerType, options.status, options.projectId]);

  return list;
}

export type UseWorkersResult = ReturnType<typeof useWorkers>;
