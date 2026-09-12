import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface AvatarProps {
  name: string;
  size?: number;
  tone?: 'primary' | 'navy' | 'success' | 'muted';
}

const TONES = {
  primary: ['#FDEBE0', '#E8590C'],
  navy: ['#E4E9F2', '#17263B'],
  success: ['#E1F3E8', '#1F7A43'],
  muted: ['#EFECE8', '#6B6660'],
} as const;

export function Avatar({ name, size = 40, tone = 'navy' }: AvatarProps) {
  const { mode } = useTheme();
  const [bgLight, fgLight] = TONES[tone];
  // Dark-mode friendly variants derived by dimming the soft backgrounds.
  const bg = mode === 'dark' ? shade(bgLight) : bgLight;
  const fg = mode === 'dark' ? lighten(fgLight) : fgLight;

  const initials = getInitials(name);

  return (
    <View
      accessibilityLabel={`${name} avatar`}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={{ color: fg, fontSize: size * 0.38, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Mix a hex color toward the dark background so soft chips stay subtle. */
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.25 + 18);
  const g = Math.round(((n >> 8) & 255) * 0.25 + 19);
  const b = Math.round((n & 255) * 0.25 + 21);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * 0.7 + 90));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * 0.7 + 90));
  const b = Math.min(255, Math.round((n & 255) * 0.7 + 95));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
