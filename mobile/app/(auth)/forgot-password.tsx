import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

/**
 * Password reset requires server-side email infrastructure that BuildTrack's
 * self-hosted API doesn't include, so this screen explains the recovery path.
 */
export default function ForgotPasswordScreen() {
  const { colors, radius, spacing } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl }}
    >
      <View style={{ paddingTop: spacing.xxl * 1.5 }}>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        </Link>

        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            backgroundColor: colors.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.xl,
          }}
        >
          <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
        </View>

        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.lg, letterSpacing: -0.4 }}>
          Reset your password
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14.5, marginTop: 8, lineHeight: 21 }}>
          Password resets are handled by your company owner to keep site data safe.
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            padding: spacing.lg,
            marginTop: spacing.xl,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
              Ask your company owner to open <Text style={{ fontWeight: '700' }}>Profile → Team</Text> and send you a reset link.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Ionicons name="key-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
              Already logged in? Change it anytime from <Text style={{ fontWeight: '700' }}>Profile → Change password</Text>.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Link href="/(auth)/login" asChild>
            <Pressable hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>
                Back to login
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
