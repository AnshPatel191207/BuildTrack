import { useCallback, useMemo } from 'react';
import { projectService } from '@/services/projectService';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { useDebouncedValue } from './useDebounce';
import { usePagination } from './usePagination';
import type { Project, ProjectStatus } from '@/types';

/**
 * Paginated project list with debounced server-side search and
 * auto-refresh when projects change anywhere in the app.
 */
export function useProjects(options: { search?: string; status?: ProjectStatus | '' } = {}) {
  const search = useDebouncedValue(options.search ?? '', 350);
  const version = useDataVersionKey(DATA_KEYS.projects);

  const fetchPage = useCallback(
    (page: number) =>
      projectService.listProjects({
        search: search || undefined,
        status: options.status,
        page,
        limit: 20,
      }),
    [search, options.status],
  );

  const list = usePagination<Project>(fetchPage, [version, search, options.status]);

  return {
    ...list,
    isStale: false,
  };
}

export type UseProjectsResult = ReturnType<typeof useProjects>;
export type ProjectItem = Project;
