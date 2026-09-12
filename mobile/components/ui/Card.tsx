import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  title?: string;
  action?: React.ReactNode;
}

/** Surface container — the base building block for list items and sections. */
export function Card({ children, style, padded = true, title, action }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        padded && styles.padded,
        style,
      ]}
    >
      {title || action ? (
        <View style={styles.header}>
          {title ? (
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
              {title}
            </Text>
          ) : null}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
});
