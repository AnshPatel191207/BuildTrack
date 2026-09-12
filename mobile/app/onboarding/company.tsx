import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { companySchema, type CompanyInput } from '@/schemas';
import { companyService } from '@/services/companyService';

export default function CreateCompanyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const showToast = useUIStore((s) => s.showToast);
  const { colors, spacing } = theme;

  const form = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: '', phone: '', email: '', address: '' },
  });
  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: CompanyInput) => {
    try {
      await companyService.createCompany({
        name: values.name.trim(),
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address?.trim() || undefined,
      });
      await refreshUser();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/onboarding/project');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create company', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxl * 1.4, paddingBottom: spacing.xl }}>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 13 }}>1</Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: colors.borderStrong }]} />
            <View style={[styles.stepDot, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 13 }}>2</Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: colors.borderStrong }]} />
            <View style={[styles.stepDot, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="checkmark" size={14} color={colors.textMuted} />
            </View>
          </View>

          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.lg, letterSpacing: -0.4 }}>
            Set up your company
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14.5, marginTop: 6 }}>
            This is the business you manage — projects and workers belong to it.
          </Text>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <FormInput
              control={form.control}
              name="name"
              label="Company name"
              placeholder="e.g. Patel Construction Co."
              autoCapitalize="words"
              required
            />
            <FormInput
              control={form.control}
              name="phone"
              label="Phone (optional)"
              placeholder="9876543210"
              keyboardType="phone-pad"
            />
            <FormInput
              control={form.control}
              name="email"
              label="Email (optional)"
              placeholder="office@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormInput
              control={form.control}
              name="address"
              label="Office address (optional)"
              placeholder="Street, city, PIN"
              multiline
            />
            <Button
              label="Continue"
              size="lg"
              loading={submitting}
              onPress={form.handleSubmit(onSubmit)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    borderRadius: 1,
  },
});
