import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
  dot?: boolean;
}

export function Badge({ label, tone = 'neutral', dot, style }: BadgeProps) {
  const { colors, radius, spacing } = useTheme();

  const { bg, fg } = (() => {
    switch (tone) {
      case 'success':
        return { bg: colors.successSoft, fg: colors.success };
      case 'warning':
        return { bg: colors.warningSoft, fg: colors.warning };
      case 'danger':
        return { bg: colors.dangerSoft, fg: colors.danger };
      case 'info':
        return { bg: colors.infoSoft, fg: colors.info };
      case 'orange':
        return { bg: colors.primaryMuted, fg: colors.primary };
      default:
        return { bg: colors.surfaceAlt, fg: colors.textMuted };
    }
  })();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 3,
        },
        style,
      ]}
    >
      {dot ? (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: fg,
            marginRight: 5,
          }}
        />
      ) : null}
      <Text
        style={{
          color: fg,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
