import { useRouter } from 'expo-router';
import { View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { leadService } from '@/services/erpService';
import { LEAD_SOURCE_OPTIONS, LEAD_STAGE_OPTIONS } from '@/constants/options';
import { leadSchema, type LeadFormInput } from '@/schemas';

export default function LeadModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm<LeadFormInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      phone: '',
      source: 'walk_in',
      stage: 'new',
      interestedIn: '',
    },
  });

  useEffect(() => {
    leadService.list({ limit: 1 }).catch(() => {});
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const onSubmit = async (values: LeadFormInput) => {
    setSaving(true);
    try {
      await leadService.create(values as Record<string, unknown>);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`Lead "${values.name}" created`);
      bump(DATA_KEYS.leads);
      bump(DATA_KEYS.customers);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save lead', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Add lead"
      subtitle="Capture the enquiry while it's fresh"
      submitting={saving}
      submitLabel="Save lead"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormInput control={form.control} name="name" label="Name" autoCapitalize="words" required />
      <FormInput control={form.control} name="phone" label="Phone" keyboardType="phone-pad" required />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Source"
            options={[...LEAD_SOURCE_OPTIONS]}
            value={form.watch('source')}
            onChange={(v) => form.setValue('source', v as LeadFormInput['source'], { shouldValidate: true })}
            required
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Stage"
            options={[...LEAD_STAGE_OPTIONS]}
            value={form.watch('stage')}
            onChange={(v) => form.setValue('stage', v as LeadFormInput['stage'], { shouldValidate: true })}
            required
          />
        </View>
      </View>
      <FormInput control={form.control} name="interestedIn" label="Interested in (optional)" placeholder="e.g. 2 BHK East facing" autoCapitalize="sentences" />
    </FormModalShell>
  );
}



