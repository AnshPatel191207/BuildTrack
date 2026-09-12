import { useRouter } from 'expo-router';
import { View } from 'react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { contractorService } from '@/services/erpService';
import { WORK_TYPE_OPTIONS } from '@/constants/options';
import { contractorSchema } from '@/schemas';

export default function ContractorModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(contractorSchema),
    defaultValues: {
      name: '',
      companyName: '',
      phone: '',
      workType: 'rcc',
      gstNumber: '',
    },
  });

  const onSubmit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await contractorService.create({ ...values, workTypes: [values.workType] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Contractor added');
      bump(DATA_KEYS.contractors);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save contractor', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Add contractor"
      subtitle="Work partners & their bills"
      submitting={saving}
      submitLabel="Save contractor"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormInput control={form.control} name="name" label="Contractor name" autoCapitalize="words" required />
      <FormInput control={form.control} name="companyName" label="Firm / company (optional)" autoCapitalize="words" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="phone" label="Phone" keyboardType="phone-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Primary work type"
            options={[...WORK_TYPE_OPTIONS]}
            value={form.watch('workType')}
            onChange={(v) => form.setValue('workType', v as never, { shouldValidate: true })}
            required
          />
        </View>
      </View>
      <FormInput control={form.control} name="gstNumber" label="GST number (optional)" autoCapitalize="characters" />
    </FormModalShell>
  );
}

