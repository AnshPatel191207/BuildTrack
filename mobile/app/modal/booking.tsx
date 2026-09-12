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
import { bookingService, customerService, unitService } from '@/services/erpService';
import { projectService } from '@/services/projectService';
import { bookingSchema } from '@/schemas';
import { formatCompactINR, formatDate, todayISO } from '@/lib/format';
import type { Customer, Unit } from '@/types';

export default function BookingModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');

  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      projectId: '',
      customerId: '',
      bookingAmount: undefined as unknown as number,
      bookingDate: todayISO(),
      notes: '',
    },
  });

  const selectedProject = form.watch('projectId');
  const selectedUnit = units.find((u) => u._id === unitId);

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) => setProjects(list.items.map((p) => ({ label: p.name, value: p._id }))))
      .catch(() => {});
    customerService
      .list({ limit: 100 })
      .then((res) => setCustomers(res.items))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!selectedProject || selectedProject.length < 24) return;
    setUnitId('');
    unitService
      .list({ projectId: selectedProject, status: 'available', limit: 100 })
      .then((res) => setUnits(res.items))
      .catch(() => {});
  }, [selectedProject]);

  const onSubmit = async (values: {
    projectId: string;
    customerId: string;
    bookingAmount: number;
    bookingDate: string;
    notes?: string;
  }) => {
    if (!unitId) {
      showToast('Choose an available unit', 'error');
      return;
    }
    setSaving(true);
    try {
      await bookingService.create({
        projectId: values.projectId,
        customerId: values.customerId,
        unitId,
        bookingAmount: Number(values.bookingAmount),
        bookingDate: values.bookingDate,
        notes: values.notes,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Booking created — sent for approval');
      bump(DATA_KEYS.bookings);
      bump(DATA_KEYS.units);
      bump(DATA_KEYS.approvals);
      bump(DATA_KEYS.customers);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create booking', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="New booking"
      subtitle="Reserve a unit for a customer"
      submitting={saving}
      submitLabel="Create booking"
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
      <SelectField
        label="Customer"
        placeholder={customers.length ? 'Choose a customer' : 'Loading customers…'}
        options={customers.map((c) => ({ label: `${c.name} · ${c.phone}`, value: c._id }))}
        value={form.watch('customerId')}
        onChange={(v) => form.setValue('customerId', v, { shouldValidate: true })}
        error={form.formState.errors.customerId?.message}
        required
      />
      <SelectField
        label="Unit"
        placeholder={units.length ? 'Choose a unit' : 'No available units in this project'}
        options={units.map((u) => ({
          label: `${u.unitNumber} · ${u.unitType} · ${formatCompactINR(u.totalValue)}`,
          value: u._id,
        }))}
        value={unitId}
        onChange={setUnitId}
        required
      />
      {selectedUnit ? (
        <FormInput
          control={form.control}
          name="bookingAmount"
          label={`Booking amount (unit value ${formatCompactINR(selectedUnit.totalValue)})`}
          keyboardType="numeric"
          prefix="₹"
          required
        />
      ) : (
        <FormInput control={form.control} name="bookingAmount" label="Booking amount" keyboardType="numeric" prefix="₹" editable={false} value="" required />
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput
            control={form.control}
            name="bookingDate"
            label="Booking date"
            editable={false}
            value={formatDate(form.watch('bookingDate'))}
            required
          />
        </View>
        <View style={{ flex: 1.4 }}>
          <FormInput control={form.control} name="notes" label="Notes (optional)" />
        </View>
      </View>
    </FormModalShell>
  );
}
