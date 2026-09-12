import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface UploadProgressProps {
  /** 0..1 */
  fraction: number;
  label?: string;
}

/** Inline upload progress card — used while media is uploading on site Wi-Fi. */
export function UploadProgress({ fraction, label = 'Uploading…' }: UploadProgressProps) {
  const { colors, radius, spacing } = useTheme();
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '700', flex: 1 }}>
          {label}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 13.5, fontWeight: '800' }}>{pct}%</Text>
      </View>
      <View
        style={[
          styles.track,
          { backgroundColor: colors.surfaceAlt, borderRadius: 3, marginTop: spacing.sm },
        ]}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: colors.primary,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  track: {
    height: 6,
    overflow: 'hidden',
  },
});
