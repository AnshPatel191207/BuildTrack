import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'bt.themeMode';
const NOTIF_PREFS_KEY = 'bt.notifPrefs';

export interface NotificationPrefs {
  dailyReportReminder: boolean;
  expenseAlerts: boolean;
  lowStockAlerts: boolean;
}

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface UIState {
  themeMode: ThemeMode;
  themeLoaded: boolean;
  notifPrefs: NotificationPrefs;
  toast: Toast | null;
  unreadNotifications: number;
  setThemeMode: (mode: ThemeMode) => void;
  loadPersistedUi: () => Promise<void>;
  setNotifPref: (key: keyof NotificationPrefs, value: boolean) => void;
  showToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: () => void;
  setUnread: (count: number) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

async function persistTheme(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, mode);
  } catch {
    // best-effort
  }
}

async function persistNotifPrefs(prefs: NotificationPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  themeMode: 'system',
  themeLoaded: false,
  notifPrefs: {
    dailyReportReminder: true,
    expenseAlerts: true,
    lowStockAlerts: true,
  },
  toast: null,
  unreadNotifications: 0,

  setThemeMode: (mode) => {
    set({ themeMode: mode });
    void persistTheme(mode);
  },

  loadPersistedUi: async () => {
    if (get().themeLoaded) return;
    try {
      const [theme, prefsRaw] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(NOTIF_PREFS_KEY),
      ]);
      const patch: Partial<UIState> = { themeLoaded: true };
      if (theme === 'light' || theme === 'dark' || theme === 'system') {
        patch.themeMode = theme;
      }
      if (prefsRaw) {
        try {
          patch.notifPrefs = { ...get().notifPrefs, ...JSON.parse(prefsRaw) };
        } catch {
          // corrupted prefs — keep defaults
        }
      }
      set(patch as UIState);
    } catch {
      set({ themeLoaded: true });
    }
  },

  setNotifPref: (key, value) => {
    const prefs = { ...get().notifPrefs, [key]: value };
    set({ notifPrefs: prefs });
    void persistNotifPrefs(prefs);
  },

  showToast: (message, tone = 'success') => {
    toastId += 1;
    set({ toast: { id: toastId, message, tone } });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 2800);
  },
  dismissToast: () => set({ toast: null }),
  setUnread: (count) => set({ unreadNotifications: count }),
}));
