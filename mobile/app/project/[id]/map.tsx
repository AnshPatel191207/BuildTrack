import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Skeleton } from '@/components/ui/Feedback';
import { ErrorState } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { projectService } from '@/services/projectService';
import { formatCoords } from '@/lib/geo';

/** Read-only site map — center pin + geofence circle for the whole crew. */
export default function ProjectMapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const projectRes = useResource(() => projectService.getProject(id!), [id]);
  const project = projectRes.data;

  if (projectRes.error && !project) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Site map" onBack={() => router.back()} />
        <ErrorState message={projectRes.error} onRetry={() => void projectRes.reload()} />
      </View>
    );
  }

  if (!project || project.latitude == null || project.longitude == null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Site map" onBack={() => router.back()} />
        <OfflineBanner />
        {!project ? (
          <Skeleton height={220} style={{ borderRadius: radius.lg, marginHorizontal: spacing.lg }} />
        ) : (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl }}>
            <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              This site hasn't been pinned on the map yet. Open Site location to drop the pin.
            </Text>
          </View>
        )}
      </View>
    );
  }

  const center = { latitude: project.latitude, longitude: project.longitude };
  const radiusM = project.siteRadiusMeters ?? 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Site map"
        subtitle={[project.name, formatCoords(project.latitude, project.longitude)].filter(Boolean).join(' · ')}
        onBack={() => router.back()}
      />
      <OfflineBanner />

      <View style={{ flex: 1 }}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            ...center,
            latitudeDelta: Math.max(0.008, radiusM / 25000),
            longitudeDelta: Math.max(0.008, radiusM / 25000),
          }}
        >
          <Marker coordinate={center} title={project.name} description="Site center" />
          <Circle
            center={center}
            radius={radiusM}
            strokeColor={colors.primary}
            fillColor={`${colors.primary}22`}
            strokeWidth={2}
          />
        </MapView>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + 16,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 12.5 }}>
            Geofence radius: <Text style={{ fontWeight: '800' }}>{radiusM}m</Text> — attendance is GPS-verified inside this circle.
          </Text>
        </View>
      </View>
    </View>
  );
}
