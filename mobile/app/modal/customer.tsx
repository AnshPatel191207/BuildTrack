import { useRouter } from 'expo-router';
import { View } from 'react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { customerService } from '@/services/erpService';
import {
  CUSTOMER_STAGE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
} from '@/constants/options';
import { customerSchema, type CustomerFormInput } from '@/schemas';

export default function CustomerModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      city: '',
      state: '',
      pan: '',
      occupation: '',
      leadSource: 'walk_in',
      journeyStage: 'inquiry',
    },
  });

  const onSubmit = async (values: CustomerFormInput) => {
    setSaving(true);
    try {
      await customerService.create(values as Record<string, unknown>);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`${values.name} added`);
      bump(DATA_KEYS.customers);
      bump(DATA_KEYS.leads);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Add customer"
      subtitle="Start the buyer journey"
      submitting={saving}
      submitLabel="Save customer"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormInput control={form.control} name="name" label="Full name" autoCapitalize="words" required />
      <FormInput control={form.control} name="phone" label="Phone" keyboardType="phone-pad" required />
      <FormInput control={form.control} name="email" label="Email (optional)" autoCapitalize="none" keyboardType="email-address" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="city" label="City" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="state" label="State" />
        </View>
      </View>
      <FormInput control={form.control} name="pan" label="PAN (optional)" autoCapitalize="characters" />
      <FormInput control={form.control} name="occupation" label="Occupation (optional)" />
      <SelectField
        label="Lead source"
        options={[...LEAD_SOURCE_OPTIONS]}
        value={form.watch('leadSource')}
        onChange={(v) => form.setValue('leadSource', v as CustomerFormInput['leadSource'], { shouldValidate: true })}
        required
      />
      <SelectField
        label="Journey stage"
        options={[...CUSTOMER_STAGE_OPTIONS]}
        value={form.watch('journeyStage')}
        onChange={(v) => form.setValue('journeyStage', v as CustomerFormInput['journeyStage'], { shouldValidate: true })}
        required
      />
    </FormModalShell>
  );
}
