import { useMemo } from 'react';
import { materialService } from '@/services/materialService';
import { DATA_KEYS, useDataVersionKey } from '@/stores/dataVersion';
import { useDebouncedValue } from './useDebounce';
import { useResource } from './useResource';

/**
 * Material stock list for a project with debounced client-side search
 * (name / category) — the catalogue per site is small enough to filter
 * locally while staying instant.
 */
export function useMaterials(projectId: string | null | undefined, search?: string) {
  const debounced = useDebouncedValue(search ?? '', 350);
  const version = useDataVersionKey(DATA_KEYS.materials);

  const resource = useResource(
    () => materialService.listMaterials({ projectId: projectId ?? undefined }),
    [projectId, version],
    { enabled: Boolean(projectId) },
  );

  const filtered = useMemo(() => {
    const all = resource.data?.materials ?? [];
    if (!debounced.trim()) return all;
    const q = debounced.trim().toLowerCase();
    return all.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
    );
  }, [resource.data, debounced]);

  return {
    ...resource,
    materials: filtered,
    summary: resource.data?.summary ?? null,
  };
}

export type UseMaterialsResult = ReturnType<typeof useMaterials>;
