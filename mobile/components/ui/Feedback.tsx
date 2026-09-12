import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.wrap, { paddingVertical: spacing.xxl * 1.5 }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={30} color={colors.textFaint} />
      </View>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md }}>
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 13.5,
            textAlign: 'center',
            marginTop: spacing.sm,
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg, width: '70%' }}>
          <Button label={actionLabel} onPress={onAction} size="sm" />
        </View>
      ) : null}
    </View>
  );
}

interface ErrorStateProps {
  message?: string;
  offline?: boolean;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong.', offline, onRetry }: ErrorStateProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: offline ? colors.warningSoft : colors.dangerSoft,
          borderRadius: radius.md,
          padding: spacing.lg,
        },
      ]}
    >
      <Ionicons
        name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
        size={26}
        color={offline ? colors.warning : colors.danger}
      />
      <Text style={{ color: colors.text, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' }}>
        {offline ? "You're offline" : 'Something went wrong'}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Skeleton({ width, height = 14, style }: { width?: number | `${number}%`; height?: number; style?: object }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: radius.sm,
          backgroundColor: colors.skeleton,
          opacity: 0.7,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
