import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ProgressBarProps {
  fraction: number; // 0..1 (clamped)
  height?: number;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'navy';
  showLabel?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  fraction,
  height = 8,
  tone = 'primary',
  showLabel = false,
  label,
  style,
}: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const pct = Math.round(Math.min(1, Math.max(0, fraction || 0)) * 100);

  const fill =
    tone === 'primary'
      ? colors.primary
      : tone === 'success'
        ? colors.success
        : tone === 'warning'
          ? colors.warning
          : tone === 'danger'
            ? colors.danger
            : colors.navy;

  return (
    <View>
      {showLabel ? (
        <View style={styles.labelRow}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
            {label ?? 'Progress'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{pct}%</Text>
        </View>
      ) : null}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        style={[
          {
            height,
            backgroundColor: colors.surfaceAlt,
            borderRadius: height / 2,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: fill,
            borderRadius: height / 2,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
});
