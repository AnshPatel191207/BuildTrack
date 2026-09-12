import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { companyService } from '@/services/companyService';
import type { Company } from '@/types';

export default function CompanyEditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { colors, spacing } = theme;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    companyService
      .getCompany()
      .then((company: Company) => {
        setName(company.name);
        setPhone(company.phone ?? '');
        setEmail(company.email ?? '');
        setAddress(company.address ?? '');
      })
      .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load company', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (name.trim().length < 2) {
      showToast('Company name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await companyService.updateCompany({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
      await refreshUser();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Company updated');
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update company', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader title="Company details" onBack={() => router.back()} />
        {loading ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={48} style={{ borderRadius: 10 }} />
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
            <Input label="Company name" value={name} onChangeText={setName} placeholder="e.g. Patel Construction Co." autoCapitalize="words" required />
            <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="Office phone" keyboardType="phone-pad" />
            <Input label="Email" value={email} onChangeText={setEmail} placeholder="office@company.com" keyboardType="email-address" autoCapitalize="none" />
            <Input
              label="Office address"
              value={address}
              onChangeText={setAddress}
              placeholder="Street, city, PIN"
              multiline
            />
            <Button label={saving ? 'Saving…' : 'Save changes'} loading={saving} onPress={() => void save()} size="lg" style={{ marginTop: 8 }} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
