import React, { createContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { DARK_COLORS, LIGHT_COLORS, RADIUS, SPACING, TYPE_SCALE, type Palette } from '@/constants/theme';
import { useUIStore } from '@/stores/uiStore';

export interface Theme {
  mode: 'light' | 'dark';
  colors: Palette;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  type: typeof TYPE_SCALE;
}

export const ThemeContext = createContext<Theme | null>(null);

interface ProviderProps {
  children: React.ReactNode;
}

/**
 * Resolves the effective theme from the user's preference (system/light/dark)
 * and the OS color scheme, then exposes palette + metrics via context.
 */
export function AppThemeProvider({ children }: ProviderProps) {
  const themeMode = useUIStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  const theme = useMemo<Theme>(() => {
    const mode =
      themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
    return {
      mode,
      colors: mode === 'dark' ? DARK_COLORS : LIGHT_COLORS,
      spacing: SPACING,
      radius: RADIUS,
      type: TYPE_SCALE,
    };
  }, [themeMode, systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
