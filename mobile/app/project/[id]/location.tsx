import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PermissionState } from '@/components/ui/PermissionState';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion } from '@/stores/dataVersion';
import { DATA_KEYS } from '@/stores/dataVersion';
import { projectService } from '@/services/projectService';
import { useLocation } from '@/hooks/useLocation';
import { haversineMeters, formatDistance, formatCoords } from '@/lib/geo';

/**
 * Pin / adjust the project site on a map. The saved center + radius power
 * GPS-verified attendance and the site map for the whole crew.
 */
export default function SiteLocationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const projectRes = useResource(() => projectService.getProject(id!), [id]);
  const project = projectRes.data;
  const { locateNow, locating, permission, requestPermission, reverseGeocode } = useLocation();

  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusM, setRadiusM] = useState<number>(150);
  const [address, setAddress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveCenter =
    center ??
    (project?.latitude != null && project?.longitude != null
      ? { latitude: project.latitude, longitude: project.longitude }
      : null);
  const effectiveRadius = center ? radiusM : project?.siteRadiusMeters ?? radiusM;

  const useMyLocation = async () => {
    const fix = await locateNow();
    if (!fix) return;
    setCenter({ latitude: fix.latitude, longitude: fix.longitude });
    setRadiusM(project?.siteRadiusMeters ?? 150);
    void reverseGeocode(fix.latitude, fix.longitude).then(setAddress);
  };

  const savePin = async () => {
    if (!effectiveCenter) return;
    setSaving(true);
    try {
      await projectService.updateProject(id!, {
        latitude: Number(effectiveCenter.latitude.toFixed(6)),
        longitude: Number(effectiveCenter.longitude.toFixed(6)),
        siteRadiusMeters: Math.round(effectiveRadius),
      });
      bump(DATA_KEYS.projects);
      showToast('Site location saved');
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save location', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Site location" onBack={() => router.back()} />
        <OfflineBanner />
        <PermissionState area="location" onRequest={() => void requestPermission()} />
      </View>
    );
  }

  // Default map viewport: project pin if present, else India-wide-ish zoom.
  const initialRegion = {
    latitude: effectiveCenter?.latitude ?? 20.59,
    longitude: effectiveCenter?.longitude ?? 78.96,
    latitudeDelta: effectiveCenter ? 0.012 : 25,
    longitudeDelta: effectiveCenter ? 0.012 : 25,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Site location" subtitle={project?.name} onBack={() => router.back()} />
      <OfflineBanner />

      <View style={{ flex: 1 }}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          onPress={(e) => {
            setCenter(e.nativeEvent.coordinate);
            setAddress(null);
            void reverseGeocode(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude).then(setAddress);
          }}
        >
          {effectiveCenter ? (
            <>
              <Marker coordinate={effectiveCenter} title="Site center" />
              <Circle
                center={effectiveCenter}
                radius={effectiveRadius}
                strokeColor={colors.primary}
                fillColor={`${colors.primary}22`}
                strokeWidth={2}
              />
            </>
          ) : null}
        </MapView>

        {/* Floating card */}
        <Card
          padded
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + 118,
            borderRadius: radius.lg,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
            {center ? 'New pin' : project?.latitude != null ? 'Current site pin' : 'No site pin yet'}
          </Text>
          {effectiveCenter ? (
            <>
              <Text style={{ color: colors.text, fontSize: 13, marginTop: 3 }}>
                {address ?? formatCoords(effectiveCenter.latitude, effectiveCenter.longitude)}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
                Check-in radius: {formatDistance(effectiveRadius)}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 3 }}>
              Tap the map or use your GPS to drop the site pin.
            </Text>
          )}

          {/* Radius stepper */}
          {center ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>Geofence:</Text>
              {[100, 150, 250, 500].map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRadiusM(r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: effectiveRadius === r }}
                  style={{
                    backgroundColor:
                      Math.round(effectiveRadius) === r ? colors.primary : colors.surfaceAlt,
                    borderRadius: radius.full,
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      color: Math.round(effectiveRadius) === r ? colors.onPrimary : colors.textMuted,
                      fontSize: 11.5,
                      fontWeight: '700',
                    }}
                  >
                    {r}m
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button
              label={locating ? 'Locating…' : 'Use my GPS'}
              variant="secondary"
              size="sm"
              loading={locating}
              onPress={() => void useMyLocation()}
              style={{ flex: 1 }}
            />
            <Button
              label="Save site"
              size="sm"
              disabled={!effectiveCenter || saving}
              loading={saving}
              onPress={() => void savePin()}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Hint chip */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: spacing.md,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <Ionicons name="information-circle-outline" size={15} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12 }}>Tap map to move the site pin</Text>
        </View>
      </View>
    </View>
  );
}
