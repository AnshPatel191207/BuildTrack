import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { milestoneService } from '@/services/erpService';
import { projectService } from '@/services/projectService';
import { milestoneSchema } from '@/schemas';

export default function MilestoneModal() {
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);

  const form = useForm({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      projectId: '',
      name: '',
      dueDate: '',
      description: '',
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
      await milestoneService.create(values);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Milestone created');
      bump(DATA_KEYS.milestones);
      bump(DATA_KEYS.progress);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save milestone', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Add milestone"
      subtitle="Foundation · Structure · Handover…"
      submitting={saving}
      submitLabel="Save milestone"
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
      <FormInput control={form.control} name="name" label="Milestone name" placeholder="e.g. Structure Complete" autoCapitalize="sentences" required />
      <FormInput control={form.control} name="dueDate" label="Due date (YYYY-MM-DD)" placeholder="2026-10-15" autoCapitalize="none" required />
      <FormInput control={form.control} name="description" label="Description (optional)" multiline />
    </FormModalShell>
  );
}
