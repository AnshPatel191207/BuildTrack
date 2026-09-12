import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { paymentService } from '@/services/erpService';
import { projectService } from '@/services/projectService';
import {
  CUSTOMER_PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
} from '@/constants/options';
import { paymentSchema } from '@/schemas';
import { formatDate, todayISO } from '@/lib/format';

export default function PaymentModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);

  const form = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      projectId: '',
      amount: undefined as unknown as number,
      paymentType: 'installment',
      method: 'bank_transfer',
      dueDate: '',
      paidDate: '',
      reference: '',
    },
  });

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) => setProjects(list.items.map((p) => ({ label: p.name, value: p._id }))))
      .catch(() => {});
  }, []);

  const onSubmit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await paymentService.create(values);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Payment recorded');
      bump(DATA_KEYS.payments);
      bump(DATA_KEYS.bookings);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not record payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Record payment"
      subtitle="Customer collection entry"
      submitting={saving}
      submitLabel="Save payment"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <SelectField
        label="Project"
        options={projects}
        value={form.watch('projectId')}
        onChange={(v) => form.setValue('projectId', v, { shouldValidate: true })}
        error={form.formState.errors.projectId?.message}
        required
      />
      <FormInput control={form.control} name="amount" label="Amount" keyboardType="numeric" prefix="₹" required />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Type"
            options={[...PAYMENT_TYPE_OPTIONS]}
            value={form.watch('paymentType')}
            onChange={(v) => form.setValue('paymentType', v as never, { shouldValidate: true })}
            required
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Method"
            options={[...CUSTOMER_PAYMENT_METHOD_OPTIONS]}
            value={form.watch('method')}
            onChange={(v) => form.setValue('method', v as never, { shouldValidate: true })}
            required
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Received on"
            options={[
              { label: `Today (${formatDate(todayISO())})`, value: todayISO() },
              { label: 'Not received yet (due)', value: '' },
            ]}
            value={form.watch('paidDate') ?? ''}
            onChange={(v) =>
              form.setValue(
                'paidDate',
                v || undefined,
              )
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="reference" label="Ref / UTR (optional)" autoCapitalize="characters" />
        </View>
      </View>
    </FormModalShell>
  );
}
