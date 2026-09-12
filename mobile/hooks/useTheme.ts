import { useContext } from 'react';
import { ThemeContext, type Theme } from '@/theme/ThemeProvider';

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <AppThemeProvider>');
  return ctx;
}
