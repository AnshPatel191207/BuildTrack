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
import { equipmentService } from '@/services/erpService';
import { projectService } from '@/services/projectService';
import { EQUIPMENT_TYPE_OPTIONS } from '@/constants/options';
import { equipmentSchema } from '@/schemas';

export default function EquipmentModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);

  const form = useForm({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      projectId: '',
      equipmentNumber: '',
      name: '',
      type: 'other',
      ownership: 'owned',
      purchaseCost: undefined as unknown as number,
      rentalCostPerDay: undefined as unknown as number,
    },
  });

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) =>
        setProjects([
          { label: 'Not assigned (yard)', value: '' },
          ...list.items.map((p) => ({ label: p.name, value: p._id })),
        ]),
      )
      .catch(() => {});
  }, []);

  const onSubmit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await equipmentService.create(values);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Equipment added');
      bump(DATA_KEYS.equipment);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save equipment', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Add equipment"
      subtitle="Owned or rented machinery"
      submitting={saving}
      submitLabel="Save equipment"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormInput control={form.control} name="name" label="Name" placeholder="e.g. Tower Crane" autoCapitalize="words" required />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="equipmentNumber" label="Equipment no." autoCapitalize="characters" required />
        </View>
        <View style={{ flex: 1.4 }}>
          <SelectField
            label="Type"
            options={[...EQUIPMENT_TYPE_OPTIONS]}
            value={form.watch('type')}
            onChange={(v) => form.setValue('type', v as never, { shouldValidate: true })}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Ownership"
            options={[
              { label: 'Owned', value: 'owned' },
              { label: 'Rented', value: 'rented' },
            ]}
            value={form.watch('ownership')}
            onChange={(v) => form.setValue('ownership', v as never, { shouldValidate: true })}
            required
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Site"
            options={[{ label: 'Loading…', value: '' }, ...projects]}
            value={form.watch('projectId') ?? ''}
            onChange={(v) => form.setValue('projectId', v)}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="purchaseCost" label="Purchase cost" keyboardType="numeric" prefix="₹" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="rentalCostPerDay" label="Rent / day" keyboardType="numeric" prefix="₹" />
        </View>
      </View>
    </FormModalShell>
  );
}
