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
import { registerSchema, type RegisterInput } from '@/schemas';
import { getApiErrorMessage } from '@/services/api';

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const status = useAuthStore((s) => s.status);
  const showToast = useUIStore((s) => s.showToast);
  const { colors, spacing } = theme;

  // New accounts go to company onboarding; existing sessions go home.
  if (status === 'onboarding') {
    return <Redirect href="/onboarding/company" />;
  }
  if (status === 'authenticated') {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });
  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: RegisterInput) => {
    try {
      await register({
        name: values.name.trim(),
        email: values.email.toLowerCase().trim(),
        phone: values.phone,
        password: values.password,
      });
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
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xl }}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.lg, letterSpacing: -0.4 }}>
            Create your account
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14.5, marginTop: 6 }}>
            You'll set up your company next — you'll be the owner.
          </Text>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <FormInput
              control={form.control}
              name="name"
              label="Full name"
              placeholder="e.g. Rajesh Patel"
              autoCapitalize="words"
              textContentType="name"
              required
            />
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              required
            />
            <FormInput
              control={form.control}
              name="phone"
              label="Mobile number"
              placeholder="9876543210"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              hint="Used for site coordination"
              required
            />
            <FormInput
              control={form.control}
              name="password"
              label="Password"
              placeholder="At least 8 characters"
              secureTextEntry
              textContentType="newPassword"
              hint="8+ characters with a letter and a number"
              required
            />
            <FormInput
              control={form.control}
              name="confirmPassword"
              label="Confirm password"
              placeholder="Repeat password"
              secureTextEntry
              textContentType="newPassword"
              required
            />

            <Button
              label="Create account"
              size="lg"
              loading={submitting}
              onPress={form.handleSubmit(onSubmit)}
              style={{ marginTop: spacing.sm }}
            />
          </View>

          <View style={[styles.footer, {}]}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Log in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
});
