import { create } from 'zustand';

/**
 * Hand-off channel for screens that capture media (camera / picker) and need
 * to deliver the local file back to the screen that requested it.
 * Router params can't carry large local URIs reliably across platforms.
 */

export interface PendingMedia {
  uri: string;
  mimeType: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

interface PendingMediaState {
  requestId: string | null;
  media: PendingMedia | null;
  setPending: (requestId: string, media: PendingMedia) => void;
  consume: (requestId: string) => PendingMedia | null;
}

export const usePendingMediaStore = create<PendingMediaState>((set, get) => ({
  requestId: null,
  media: null,
  setPending: (requestId, media) => set({ requestId, media }),
  consume: (requestId) => {
    const { requestId: stored, media } = get();
    if (stored !== requestId || !media) return null;
    set({ requestId: null, media: null });
    return media;
  },
}));
