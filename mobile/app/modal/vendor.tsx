import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { FormInput } from '@/components/ui/Input';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { vendorService } from '@/services/erpService';
import { vendorSchema } from '@/schemas';

export default function VendorModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '',
      companyName: '',
      contactPerson: '',
      phone: '',
      gstNumber: '',
      materialsSupplied: '',
    },
  });

  const onSubmit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await vendorService.create({
        ...values,
        gstNumber: values.gstNumber ? String(values.gstNumber).toUpperCase() : '',
        materialsSupplied: values.materialsSupplied
          ? String(values.materialsSupplied)
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
          : [],
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Vendor added');
      bump(DATA_KEYS.vendors);
      bump(DATA_KEYS.purchaseOrders);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save vendor', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Add vendor"
      subtitle="Supplier for materials & services"
      submitting={saving}
      submitLabel="Save vendor"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormInput control={form.control} name="name" label="Vendor name" autoCapitalize="words" required />
      <FormInput control={form.control} name="companyName" label="Company (optional)" autoCapitalize="words" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="contactPerson" label="Contact person" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="phone" label="Phone" keyboardType="phone-pad" />
        </View>
      </View>
      <FormInput control={form.control} name="gstNumber" label="GST number (optional)" autoCapitalize="characters" />
      <FormInput
        control={form.control}
        name="materialsSupplied"
        label="Materials supplied (comma separated)"
        placeholder="cement, steel, sand"
        autoCapitalize="none"
      />
    </FormModalShell>
  );
}
