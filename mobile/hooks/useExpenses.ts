import { useCallback } from 'react';
import { expenseService, type ExpenseFilters } from '@/services/projectDataService';
import { DATA_KEYS, useDataVersionKey } from '@/stores/dataVersion';
import { useDebouncedValue } from './useDebounce';
import { usePagination } from './usePagination';
import type { Expense } from '@/types';

/**
 * Paginated expense feed with debounced search (title/category),
 * category + date-range filters.
 */
export function useExpenses(filters: Omit<ExpenseFilters, 'page' | 'limit'> = {}) {
  const search = useDebouncedValue(filters.search ?? '', 350);
  const version = useDataVersionKey(DATA_KEYS.expenses);

  const fetchPage = useCallback(
    (page: number) =>
      expenseService.listExpenses({
        ...filters,
        search: search || undefined,
        page,
        limit: 20,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify({ ...filters, search: undefined }), search],
  );

  return usePagination<Expense>(fetchPage, [version]);
}

export type UseExpensesResult = ReturnType<typeof useExpenses>;
