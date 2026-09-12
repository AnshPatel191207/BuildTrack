import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { taskSchema, type TaskFormInput } from '@/schemas';
import { taskService } from '@/services/projectDataService';
import { companyService } from '@/services/companyService';
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '@/constants/options';
import { formatDate } from '@/lib/format';

export default function TaskModal() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const params = useLocalSearchParams<{ id?: string; projectId?: string }>();
  const isEdit = Boolean(params.id);
  const { colors, spacing } = theme;

  const [members, setMembers] = useState<{ label: string; value: string }[]>([]);
  const [loaded, setLoaded] = useState(!isEdit);

  const form = useForm<TaskFormInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      assignedTo: '',
      priority: 'medium',
      status: 'todo',
      dueDate: '',
    },
  });
  const submitting = form.formState.isSubmitting;
  const dueDate = form.watch('dueDate');
  const [duePickerOpen, setDuePickerOpen] = useState(false);

  useEffect(() => {
    companyService
      .listTeam()
      .then((team) =>
        setMembers([
          { label: 'Unassigned', value: '' },
          ...team
            .filter((m) => m.isActive)
            .map((m) => ({ label: m.name, value: m._id })),
        ]),
      )
      .catch(() => {});
    if (params.id) {
      taskService
        .listTasks()
        .then((tasks) => {
          const t = tasks.find((x) => x._id === params.id);
          if (!t) throw new Error('Task not found');
          form.reset({
            title: t.title,
            description: t.description ?? '',
            assignedTo: t.assignedTo?._id ?? '',
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate?.slice(0, 10) ?? '',
          });
        })
        .catch((err) =>
          showToast(err instanceof Error ? err.message : 'Could not load task', 'error'),
        )
        .finally(() => setLoaded(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: TaskFormInput) => {
    try {
      if (isEdit) {
        await taskService.updateTask(params.id!, {
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          assignedTo: values.assignedTo || null,
          priority: values.priority,
          status: values.status,
          dueDate: values.dueDate || null,
        });
        showToast('Task updated');
      } else {
        await taskService.createTask({
          projectId: params.projectId!,
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          assignedTo: values.assignedTo || null,
          priority: values.priority,
          status: values.status,
          dueDate: values.dueDate || null,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast('Task created');
      }
      bump(DATA_KEYS.tasks);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save task', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader title={isEdit ? 'Edit task' : 'New task'} onBack={() => router.back()} />
        {loaded ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
            <View style={{ gap: spacing.md }}>
              <FormInput
                control={form.control}
                name="title"
                label="What needs to be done?"
                placeholder="e.g. Slab shuttering — Tower A, 3rd floor"
                autoCapitalize="sentences"
                required
              />
              <FormInput
                control={form.control}
                name="description"
                label="Details (optional)"
                placeholder="Measurements, materials needed…"
                multiline
              />
              <SelectField
                label="Assign to"
                options={members.length ? members : [{ label: 'Loading…', value: '' }]}
                value={form.watch('assignedTo') ?? ''}
                onChange={(v) => form.setValue('assignedTo', v)}
              />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Priority"
                    options={[...TASK_PRIORITY_OPTIONS]}
                    value={form.watch('priority')}
                    onChange={(v) => form.setValue('priority', v as TaskFormInput['priority'], { shouldValidate: true })}
                    required
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Status"
                    options={[...TASK_STATUS_OPTIONS]}
                    value={form.watch('status')}
                    onChange={(v) => form.setValue('status', v as TaskFormInput['status'], { shouldValidate: true })}
                    required
                  />
                </View>
              </View>
              <Pressable
                onPress={() =>
                  dueDate
                    ? setDuePickerOpen(true)
                    : (() => {
                        // First tap picks a date; long-press clears via sheet action.
                        setDuePickerOpen(true);
                      })()
                }
                accessibilityRole="button"
                accessibilityLabel="Due date"
              >
                <View pointerEvents="none">
                  <FormInput
                    control={form.control}
                    name="dueDate"
                    label="Due date (optional)"
                    editable={false}
                    value={dueDate ? formatDate(dueDate) : ''}
                    error={form.formState.errors.dueDate?.message}
                    hint={dueDate ? undefined : 'Leave empty for no deadline'}
                  />
                </View>
              </Pressable>

              <Button
                label={isEdit ? 'Save changes' : 'Create task'}
                size="lg"
                loading={submitting}
                onPress={form.handleSubmit(onSubmit)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={48} style={{ borderRadius: 10 }} />
            ))}
          </View>
        )}
      </ScrollView>

      <DatePickerSheet
        visible={duePickerOpen}
        onClose={() => setDuePickerOpen(false)}
        value={dueDate || null}
        onChange={(iso) => form.setValue('dueDate', iso, { shouldValidate: true })}
        title="Due date"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});
