import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';

/** Global toast — mounted once in the root layout. */
export function ToastHost() {
  const toast = useUIStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (!toast) return null;

  const tone = (() => {
    switch (toast.tone) {
      case 'error':
        return { bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle' as const };
      case 'info':
        return { bg: colors.infoSoft, fg: colors.info, icon: 'information-circle' as const };
      default:
        return { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' as const };
    }
  })();

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[styles.host, { top: insets.top + 8 }]}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          { backgroundColor: colors.surface, borderColor: tone.bg },
        ]}
      >
        <Ionicons name={tone.icon} size={20} color={tone.fg} />
        <Text numberOfLines={3} style={{ color: colors.text, flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 18 }}>
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
});

export function showToast(message: string, tone: 'success' | 'error' | 'info' = 'info') {
  useUIStore.getState().showToast(message, tone);
}

