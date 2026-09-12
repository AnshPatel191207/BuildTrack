import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface MapCardProps {
  latitude: number;
  longitude: number;
  title?: string;
  address?: string | null;
  /** Meters → initial delta. */
  radiusMeters?: number;
  onPress?: () => void;
}

const DELTA_PER_METER = 0.00002;

/**
 * Compact map preview used on the project overview — shows the site pin and
 * opens the full map screen when tapped.
 */
export function MapCard({ latitude, longitude, title, address, radiusMeters = 100, onPress }: MapCardProps) {
  const { colors, radius, spacing } = useTheme();
  const delta = Math.max(0.002, (radiusMeters * 2 + 200) * DELTA_PER_METER);
  const region: Region = {
    latitude,
    longitude,
    latitudeDelta: delta * 6,
    longitudeDelta: delta * 6,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.card,
        {
          borderRadius: radius.lg,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open site map"
    >
      <MapView
        style={{ width: '100%', height: 140 }}
        initialRegion={region}
        provider={undefined}
        scrollEnabled={false}
        zoomEnabled={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        liteMode
      >
        <Marker coordinate={{ latitude, longitude }} title={title ?? 'Site'} />
      </MapView>
      <View style={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>
            {address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
          </Text>
          {onPress ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Map</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
