import { LIGHT_COLORS, DARK_COLORS, type Palette } from './theme';

export interface ProjectThemeConfig {
  primary?: string;
  secondary?: string;
  accent?: string;
  success?: string;
  warning?: string;
  danger?: string;
  info?: string;
}

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== 'string') return `rgba(232, 89, 12, ${alpha})`;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getContrastColor(hex: string): string {
  if (!hex || typeof hex !== 'string') return '#FFFFFF';
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#141416' : '#FFFFFF';
}

export function buildDynamicPalette(
  basePalette: Palette,
  themeConfig?: ProjectThemeConfig | null,
  isDark = false,
): Palette {
  if (!themeConfig || !themeConfig.primary) {
    return basePalette;
  }

  const primary = themeConfig.primary;
  const secondary = themeConfig.secondary || basePalette.navy;
  const success = themeConfig.success || basePalette.success;
  const warning = themeConfig.warning || basePalette.warning;
  const danger = themeConfig.danger || basePalette.danger;
  const info = themeConfig.info || basePalette.info;

  return {
    ...basePalette,
    primary,
    onPrimary: getContrastColor(primary),
    primaryMuted: hexToRgba(primary, isDark ? 0.22 : 0.12),
    borderStrong: hexToRgba(primary, isDark ? 0.35 : 0.28),
    navy: secondary,
    navySoft: hexToRgba(secondary, isDark ? 0.25 : 0.1),
    success,
    successSoft: hexToRgba(success, isDark ? 0.25 : 0.12),
    warning,
    warningSoft: hexToRgba(warning, isDark ? 0.25 : 0.12),
    danger,
    dangerSoft: hexToRgba(danger, isDark ? 0.25 : 0.12),
    info,
    infoSoft: hexToRgba(info, isDark ? 0.25 : 0.12),
  };
}
