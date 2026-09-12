import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';

export default function OnboardingCompleteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing } = theme;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background, paddingHorizontal: spacing.xl }]}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colors.successSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark-done" size={40} color={colors.success} />
        </View>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.lg, letterSpacing: -0.4 }}>
          You're all set!
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 14.5,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 21,
          }}
        >
          Your workspace is ready. Add workers, log expenses and mark attendance from the dashboard.
        </Text>
      </View>

      <View style={{ width: '100%', gap: spacing.md }}>
        <Button label="Go to dashboard" size="lg" onPress={() => router.replace('/(tabs)/dashboard')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
});
