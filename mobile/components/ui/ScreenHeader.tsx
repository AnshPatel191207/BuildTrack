import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
}

/** Custom header — native stack headers stay hidden app-wide. */
export function ScreenHeader({ title, subtitle, onBack, right, large }: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + (large ? spacing.md : 4), paddingHorizontal: spacing.lg }}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.backBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: large ? 26 : 19,
              fontWeight: '800',
              letterSpacing: -0.3,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

export function ThemeModeToggle() {
  const { mode } = useTheme();
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const isDark = mode === 'dark';
  return (
    <Switch
      value={isDark}
      onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
      accessibilityLabel="Toggle dark mode"
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    marginLeft: 'auto',
  },
});
