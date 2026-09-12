import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'navy';
  style?: object;
}

const TONE_COLORS = {
  default: 'textMuted',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  navy: 'navy',
} as const;

/** Compact KPI tile used on dashboards. */
export function MetricCard({ label, value, sublabel, icon, tone = 'default', style }: MetricCardProps) {
  const { colors } = useTheme();
  const accentKey = TONE_COLORS[tone];
  const accent =
    accentKey === 'textMuted'
      ? colors.text
      : accentKey === 'primary'
        ? colors.primary
        : colors[accentKey];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, style]}>
      <View style={styles.topRow}>
        <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', flex: 1 }}>
          {label}
        </Text>
        {icon ? <Ionicons name={icon} size={16} color={colors.textFaint} /> : null}
      </View>
      <Text numberOfLines={1} style={{ color: accent, fontSize: 20, fontWeight: '800', marginTop: 6, letterSpacing: -0.3 }}>
        {value}
      </Text>
      {sublabel ? (
        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 11.5, marginTop: 2 }}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
