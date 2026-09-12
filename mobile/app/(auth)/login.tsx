import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/Input';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { loginSchema, type LoginInput } from '@/schemas';
import { getApiErrorMessage } from '@/services/api';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);
  const showToast = useUIStore((s) => s.showToast);
  const { colors, radius, spacing } = theme;

  // Hooks must run unconditionally — the status guards below return early
  // once authentication succeeds, and skipping useForm() here would crash
  // React with "Rendered fewer hooks than expected".
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const submitting = form.formState.isSubmitting;

  // React to auth state — the index gate only runs on cold start.
  if (status === 'authenticated') {
    return <Redirect href="/(tabs)/dashboard" />;
  }
  if (status === 'onboarding') {
    return <Redirect href="/onboarding/company" />;
  }

  const onSubmit = async (values: LoginInput) => {
    try {
      await login(values.email.toLowerCase(), values.password);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <OfflineBanner />
        <View style={[styles.wrap, { paddingHorizontal: spacing.xl }]}>
          {/* Brand */}
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 20,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="hammer" size={34} color={colors.onPrimary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.lg, letterSpacing: -0.5 }}>
              BuildTrack
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14.5, marginTop: 6 }}>
              Run every site from your pocket.
            </Text>
          </View>

          {/* Form */}
          <View style={{ marginTop: spacing.xxl + 8, gap: spacing.md }}>
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              required
            />
            <FormInput
              control={form.control}
              name="password"
              label="Password"
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              required
            />

            <Button
              label="Log in"
              size="lg"
              loading={submitting}
              onPress={form.handleSubmit(onSubmit)}
              style={{ marginTop: spacing.sm }}
            />

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13.5 }}>
                  Forgot password?
                </Text>
              </Pressable>
            </Link>
          </View>

          <View style={[styles.footer, { paddingBottom: spacing.xxl }]}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>New to BuildTrack? </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                  Create an account
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
});
