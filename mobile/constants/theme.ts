import type { TextStyle, ViewStyle } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  navy: string;
  navySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  skeleton: string;
}

export const LIGHT_COLORS: Palette = {
  background: '#F6F4F1',
  surface: '#FFFFFF',
  surfaceAlt: '#EFECE8',
  surfaceSunken: '#F0EEEA',
  text: '#201E1C',
  textMuted: '#6B6660',
  textFaint: '#9B958D',
  border: '#E5E1DB',
  borderStrong: '#D3CEC6',
  primary: '#E8590C',
  primaryMuted: '#FDEBE0',
  onPrimary: '#FFFFFF',
  navy: '#17263B',
  navySoft: '#E4E9F2',
  success: '#1F7A43',
  successSoft: '#E1F3E8',
  warning: '#A9620A',
  warningSoft: '#FCF0DC',
  danger: '#C0362C',
  dangerSoft: '#FAE5E3',
  info: '#2563AE',
  infoSoft: '#E3EDFB',
  overlay: 'rgba(18,16,14,0.55)',
  skeleton: '#E9E5DF',
};

export const DARK_COLORS: Palette = {
  background: '#121315',
  surface: '#1B1D21',
  surfaceAlt: '#24262B',
  surfaceSunken: '#17191C',
  text: '#F0EEE9',
  textMuted: '#A7A29A',
  textFaint: '#75716A',
  border: '#2B2E33',
  borderStrong: '#3B3F46',
  primary: '#FF7A2F',
  primaryMuted: '#3A2415',
  onPrimary: '#16100B',
  navy: '#232F45',
  navySoft: '#252D3C',
  success: '#3DC476',
  successSoft: '#17301F',
  warning: '#E5A13D',
  warningSoft: '#33270F',
  danger: '#F26A60',
  dangerSoft: '#371D19',
  info: '#5C9DF0',
  infoSoft: '#18263A',
  overlay: 'rgba(0,0,0,0.65)',
  skeleton: '#24262B',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

export const TYPE_SCALE = {
  caption: { fontSize: 11, lineHeight: 14 } as TextStyle,
  small: { fontSize: 13, lineHeight: 17 } as TextStyle,
  body: { fontSize: 15, lineHeight: 21 } as TextStyle,
  title: { fontSize: 18, lineHeight: 24 } as TextStyle,
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700' } as TextStyle,
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' } as TextStyle,
};

export function shadow(style: ViewStyle['shadowColor'] = '#000'): ViewStyle {
  return {
    shadowColor: style as string,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  };
}
