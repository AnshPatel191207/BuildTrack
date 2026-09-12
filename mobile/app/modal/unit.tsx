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
import { unitService } from '@/services/erpService';
import { projectService } from '@/services/projectService';
import { UNIT_TYPE_SUGGESTIONS } from '@/constants/options';
import { unitSchema, type UnitFormInput } from '@/schemas';

export default function UnitModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);

  const form = useForm<UnitFormInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      projectId: '',
      unitNumber: '',
      unitType: '2 BHK',
      areaSqft: undefined as unknown as number,
      ratePerSqft: undefined as unknown as number,
      totalValue: undefined as unknown as number,
    },
  });

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) => setProjects(list.items.map((p) => ({ label: p.name, value: p._id }))))
      .catch(() => {});
  }, []);

  const onSubmit = async (values: UnitFormInput) => {
    setSaving(true);
    try {
      await unitService.create(values as Record<string, unknown>);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`Unit ${values.unitNumber} added`);
      bump(DATA_KEYS.units);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save unit', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Add unit"
      subtitle="Inventory for sales tracking"
      submitting={saving}
      submitLabel="Save unit"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <SelectField
        label="Project"
        placeholder={projects.length ? 'Choose a project' : 'Loading projects…'}
        options={projects}
        value={form.watch('projectId')}
        onChange={(v) => form.setValue('projectId', v, { shouldValidate: true })}
        error={form.formState.errors.projectId?.message}
        required
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="unitNumber" label="Unit number" placeholder="A-101" autoCapitalize="characters" required />
        </View>
        <View style={{ flex: 1.4 }}>
          <SelectField
            label="Type"
            options={[...UNIT_TYPE_SUGGESTIONS]}
            value={form.watch('unitType')}
            onChange={(v) => form.setValue('unitType', v, { shouldValidate: true })}
            required
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="areaSqft" label="Area (sq.ft.)" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput control={form.control} name="ratePerSqft" label="Rate / sq.ft." keyboardType="numeric" prefix="₹" />
        </View>
      </View>
      <FormInput control={form.control} name="totalValue" label="Total value" keyboardType="numeric" prefix="₹" required />
    </FormModalShell>
  );
}



