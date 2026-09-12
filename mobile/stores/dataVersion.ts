import { create } from 'zustand';

/**
 * Lightweight invalidation bus: screens bump a version after a successful
 * mutation, and any screen rendering that dataset re-fetches.
 */
interface DataVersionState {
  versions: Record<string, number>;
  bump: (key: string) => void;
}

export const useDataVersion = create<DataVersionState>((set) => ({
  versions: {},
  bump: (key) =>
    set((s) => ({ versions: { ...s.versions, [key]: (s.versions[key] ?? 0) + 1 } })),
}));

/** Convenience hook: returns the current version for a key (0 initially). */
export function useDataVersionKey(key: string): number {
  return useDataVersion((s) => s.versions[key] ?? 0);
}

export const DATA_KEYS = {
  dashboard: 'dashboard',
  projects: 'projects',
  expenses: 'expenses',
  workers: 'workers',
  materials: 'materials',
  tasks: 'tasks',
  reports: 'reports',
  photos: 'photos',
  notifications: 'notifications',
  structure: 'structure',
  units: 'units',
  customers: 'customers',
  leads: 'leads',
  bookings: 'bookings',
  payments: 'payments',
  contractors: 'contractors',
  vendors: 'vendors',
  purchaseOrders: 'purchaseOrders',
  equipment: 'equipment',
  documents: 'documents',
  approvals: 'approvals',
  milestones: 'milestones',
  progress: 'progress',
} as const;
