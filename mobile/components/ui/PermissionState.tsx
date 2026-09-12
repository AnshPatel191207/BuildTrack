import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from './Button';
import type { PermissionArea } from '@/lib/permissions';

interface PermissionStateProps {
  area: PermissionArea;
  /** true when the OS will never ask again — only Settings can fix it. */
  permanentlyDenied?: boolean;
  onRequest?: () => void;
}

/**
 * Full-area block shown when camera / location / contacts / media access is
 * missing. Offers "Try again" while the OS still allows prompts, and
 * "Open Settings" once it doesn't.
 */
export function PermissionState({ area, permanentlyDenied, onRequest }: PermissionStateProps) {
  const { colors, radius, spacing } = useTheme();

  const copy: Record<PermissionArea, { icon: keyof typeof Ionicons.glyphMap; title: string; message: string }> = {
    camera: {
      icon: 'camera-outline',
      title: 'Camera access needed',
      message: 'Allow BuildTrack to use your camera to capture site photos, delivery proof and invoice scans.',
    },
    microphone: {
      icon: 'mic-outline',
      title: 'Microphone access needed',
      message: 'Site progress videos need microphone access to record audio with the footage.',
    },
    location: {
      icon: 'location-outline',
      title: 'Location access needed',
      message: 'Pin the project site, verify worker attendance and track site visits — all on-device.',
    },
    contacts: {
      icon: 'people-outline',
      title: 'Contacts access needed',
      message: 'Import worker names and numbers straight from your phone book instead of typing them.',
    },
    mediaLibrary: {
      icon: 'images-outline',
      title: 'Photo library access needed',
      message: 'Pick existing site photos and videos from your gallery to upload.',
    },
  };

  const c = copy[area];

  return (
    <View style={[styles.wrap, { paddingVertical: spacing.xxl * 1.6 }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.surfaceAlt, borderRadius: 40, marginBottom: spacing.lg },
        ]}
      >
        <Ionicons name={c.icon} size={34} color={colors.textFaint} />
      </View>
      <Text style={{ color: colors.text, fontSize: 16.5, fontWeight: '800', textAlign: 'center' }}>
        {c.title}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 13.5,
          lineHeight: 20,
          textAlign: 'center',
          marginTop: spacing.sm,
          maxWidth: 300,
        }}
      >
        {c.message}
      </Text>

      <View style={{ marginTop: spacing.xl, width: '75%', gap: spacing.sm }}>
        {permanentlyDenied ? (
          <>
            <Button label="Open Settings" onPress={() => import('@/lib/permissions').then((m) => m.openAppSettings())} size="sm" />
            <Button label="Try again" variant="ghost" onPress={onRequest} size="sm" />
          </>
        ) : (
          <Button label="Allow access" onPress={onRequest} size="sm" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
