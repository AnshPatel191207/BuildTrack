import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import type { SiteMedia } from '@/types';

interface MediaCardProps {
  item: SiteMedia;
  onPress?: () => void;
  onLongPress?: () => void;
  size: number;
  /** Show the category badge (default true). */
  showBadge?: boolean;
}

/**
 * Gallery tile for site media — photos render a thumbnail, videos get a
 * duration overlay, document scans get a file icon.
 */
export function MediaCard({ item, onPress, onLongPress, size, showBadge = true }: MediaCardProps) {
  const { colors, radius, spacing } = useTheme();

  const badgeLabel =
    item.kind === 'video'
      ? formatDuration(item.durationSeconds)
      : item.kind === 'document'
        ? 'PDF'
        : item.category;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          marginBottom: spacing.xs,
        },
      ]}
      accessibilityRole="imagebutton"
      accessibilityLabel={item.description || badgeLabel}
    >
      {item.kind === 'image' && item.url ? (
        <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Ionicons
            name={item.kind === 'video' ? 'videocam' : 'document-text'}
            size={30}
            color={colors.textFaint}
          />
        </View>
      )}

      {showBadge ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: radius.sm,
              paddingHorizontal: 6,
              paddingVertical: 2,
            },
          ]}
        >
          <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{badgeLabel}</Text>
        </View>
      ) : null}

      {item.kind === 'video' ? (
        <View style={[styles.playIcon]}>
          <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.92)" />
        </View>
      ) : null}
    </Pressable>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'Video';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    alignSelf: 'flex-start',
  },
  playIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
