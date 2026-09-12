import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isOnline: boolean;
  /** Bumped whenever connectivity flips back on — screens can re-sync. */
  reconnectCount: number;
  setOnline: (online: boolean) => void;
  startListening: () => () => void;
}

let unsubscribe: (() => void) | null = null;

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: true,
  reconnectCount: 0,
  setOnline: (online) => {
    if (get().isOnline === online) return;
    set((s) => ({
      isOnline: online,
      reconnectCount: online ? s.reconnectCount + 1 : s.reconnectCount,
    }));
  },
  startListening: () => {
    if (unsubscribe) return unsubscribe!;
    unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      get().setOnline(online);
    });
    return () => {
      unsubscribe?.();
      unsubscribe = null;
    };
  },
}));
