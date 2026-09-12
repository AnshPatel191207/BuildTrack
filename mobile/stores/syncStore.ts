import { create } from 'zustand';
import {
  countOutbox,
  listOutbox,
  removeOutboxEntry,
  clearOutbox,
} from '@/lib/offline';
import { api } from '@/services/api';
import { useUIStore } from './uiStore';

interface SyncState {
  /** Number of writes waiting in the outbox. */
  pendingCount: number;
  flushing: boolean;
  lastSyncedAt: number | null;
  refreshCount: () => Promise<void>;
  flushOutbox: () => Promise<boolean>;
  discardAll: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  pendingCount: 0,
  flushing: false,
  lastSyncedAt: null,

  refreshCount: async () => {
    const n = await countOutbox();
    set({ pendingCount: n });
  },

  /**
   * Replay queued mutations oldest-first. Entries are removed after a 2xx
   * (or a permanent client error — retrying would never succeed).
   * Network errors stop the flush and keep entries for the next attempt.
   */
  flushOutbox: async (): Promise<boolean> => {
    if (get().flushing) return false;
    set({ flushing: true });
    try {
      const entries = await listOutbox();
      let failed = 0;
      for (const entry of entries) {
        try {
          await api.request({
            method: entry.method,
            url: entry.url,
            data: entry.body ? JSON.parse(entry.body) : undefined,
            headers: entry.body ? { 'Content-Type': 'application/json' } : undefined,
            timeout: 20_000,
          });
          await removeOutboxEntry(entry.id);
        } catch (err: any) {
          if (err?.response) {
            // Server rejected permanently (validation/conflict/401 handled by
            // interceptors). Drop it rather than poison the queue forever.
            await removeOutboxEntry(entry.id);
          } else {
            failed += 1;
            break; // still offline — retry later
          }
        }
      }
      const remaining = await countOutbox();
      set({ pendingCount: remaining, flushing: false });
      if (entries.length > 0 && remaining === 0 && failed === 0) {
        set({ lastSyncedAt: Date.now() });
        useUIStore.getState().showToast('Offline changes synced', 'success');
      }
      return remaining === 0;
    } catch {
      set({ flushing: false });
      return false;
    }
  },

  discardAll: async () => {
    await clearOutbox();
    set({ pendingCount: 0 });
  },
}));
