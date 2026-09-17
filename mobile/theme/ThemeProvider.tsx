import React, { createContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { DARK_COLORS, LIGHT_COLORS, RADIUS, SPACING, TYPE_SCALE, type Palette } from '@/constants/theme';
import { buildDynamicPalette } from '@/constants/dynamicTheme';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';

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
 * Resolves the effective theme from the user's preference (system/light/dark),
 * the OS color scheme, and the active project's dynamic theme colors.
 */
export function AppThemeProvider({ children }: ProviderProps) {
  const themeMode = useUIStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const activeTheme = useProjectStore((s) => s.activeTheme);
  const loadActiveProject = useProjectStore((s) => s.loadActiveProject);

  useEffect(() => {
    void loadActiveProject();
  }, [loadActiveProject]);

  const theme = useMemo<Theme>(() => {
    const mode =
      themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
    const basePalette = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    const dynamicPalette = buildDynamicPalette(basePalette, activeTheme, mode === 'dark');

    return {
      mode,
      colors: dynamicPalette,
      spacing: SPACING,
      radius: RADIUS,
      type: TYPE_SCALE,
    };
  }, [themeMode, systemScheme, activeTheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

