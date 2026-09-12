import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useNetworkStore } from '@/stores/networkStore';

/** Slim banner shown under headers when the device is offline. */
export function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { colors, spacing } = useTheme();
  if (isOnline) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: colors.warningSoft,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm + 2,
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
      <Text style={{ color: colors.warning, fontSize: 12.5, fontWeight: '700', marginLeft: 6 }}>
        Offline — showing saved data
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
