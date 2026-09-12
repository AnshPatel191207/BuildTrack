import React, { useEffect, useState } from 'react';
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
import { workerSchema, type WorkerFormInput } from '@/schemas';
import { workerService } from '@/services/workerService';
import { projectService } from '@/services/projectService';
import {
  WORKER_TYPE_OPTIONS,
  WORKER_STATUS_OPTIONS,
} from '@/constants/options';
import { formatDate, todayISO } from '@/lib/format';

export default function WorkerModal() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const params = useLocalSearchParams<{
    id?: string;
    projectId?: string;
    prefillName?: string;
    prefillPhone?: string;
  }>();
  const isEdit = Boolean(params.id);
  const { colors, spacing } = theme;

  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);
  const [loaded, setLoaded] = useState(!isEdit);

  const form = useForm<WorkerFormInput>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      name: params.prefillName ?? '',
      phone: params.prefillPhone ?? '',
      workerType: 'helper',
      dailyWage: undefined as unknown as number,
      skill: '',
      projectId: params.projectId ?? '',
      joiningDate: todayISO(),
    },
  });
  const submitting = form.formState.isSubmitting;
  const joiningDate = form.watch('joiningDate');
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) =>
        setProjects([
          { label: 'No fixed site (floating)', value: '' },
          ...list.items.map((p) => ({ label: p.name, value: p._id })),
        ]),
      )
      .catch(() => {});
    if (params.id) {
      workerService
        .getWorker(params.id)
        .then(({ worker }) => {
          form.reset({
            name: worker.name,
            phone: worker.phone ?? '',
            workerType: worker.workerType,
            dailyWage: worker.dailyWage,
            skill: worker.skill ?? '',
            projectId:
              typeof worker.projectId === 'object' && worker.projectId
                ? worker.projectId._id
                : '',
            joiningDate: worker.joiningDate.slice(0, 10),
          });
        })
        .catch((err) =>
          showToast(err instanceof Error ? err.message : 'Could not load worker', 'error'),
        )
        .finally(() => setLoaded(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: WorkerFormInput) => {
    try {
      if (isEdit) {
        await workerService.updateWorker(params.id!, {
          name: values.name.trim(),
          phone: values.phone || undefined,
          workerType: values.workerType,
          dailyWage: Number(values.dailyWage) || 0,
          skill: values.skill?.trim() || undefined,
          projectId: values.projectId || null,
          joiningDate: values.joiningDate,
        });
        showToast(`${values.name.trim()} updated`);
      } else {
        await workerService.createWorker({
          name: values.name.trim(),
          phone: values.phone || undefined,
          workerType: values.workerType,
          dailyWage: Number(values.dailyWage) || 0,
          skill: values.skill?.trim() || undefined,
          projectId: values.projectId || null,
          joiningDate: values.joiningDate,
          status: 'active',
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast(`${values.name.trim()} added to the crew`);
      }
      bump(DATA_KEYS.workers);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save worker', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader
          title={isEdit ? 'Edit worker' : 'Add worker'}
          subtitle={isEdit ? undefined : 'Daily-wage crew member'}
          onBack={() => router.back()}
        />
        {loaded ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
            <View style={{ gap: spacing.md }}>
              <FormInput
                control={form.control}
                name="name"
                label="Full name"
                placeholder="e.g. Ramesh Bhai"
                autoCapitalize="words"
                required
              />
              <FormInput
                control={form.control}
                name="phone"
                label="Phone (optional)"
                placeholder="9876543210"
                keyboardType="phone-pad"
              />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1.2 }}>
                  <SelectField
                    label="Trade"
                    options={[...WORKER_TYPE_OPTIONS]}
                    value={form.watch('workerType')}
                    onChange={(v) => form.setValue('workerType', v as WorkerFormInput['workerType'], { shouldValidate: true })}
                    error={form.formState.errors.workerType?.message}
                    required
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormInput
                    control={form.control}
                    name="dailyWage"
                    label="Daily wage"
                    placeholder="800"
                    keyboardType="numeric"
                    prefix="₹"
                    required
                  />
                </View>
              </View>
              <FormInput
                control={form.control}
                name="skill"
                label="Special skill (optional)"
                placeholder="e.g. Shuttering, bar bending"
              />
              <SelectField
                label="Home site"
                options={projects.length ? projects : [{ label: 'Loading…', value: '' }]}
                value={form.watch('projectId') ?? ''}
                onChange={(v) => form.setValue('projectId', v)}
                error={form.formState.errors.projectId?.message}
                hint="Workers can be marked present on any site; this is their default."
              />
              <Pressable
                onPress={() => setDatePickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Joining date"
              >
                <View pointerEvents="none">
                  <FormInput
                    control={form.control}
                    name="joiningDate"
                    label="Joined on"
                    editable={false}
                    value={formatDate(joiningDate)}
                    error={form.formState.errors.joiningDate?.message}
                    required
                  />
                </View>
              </Pressable>

              <Button
                label={isEdit ? 'Save changes' : 'Add to crew'}
                size="lg"
                loading={submitting}
                onPress={form.handleSubmit(onSubmit)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={48} style={{ borderRadius: 10 }} />
            ))}
          </View>
        )}
      </ScrollView>

      <DatePickerSheet
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={joiningDate || null}
        onChange={(iso) => form.setValue('joiningDate', iso, { shouldValidate: true })}
        title="Joining date"
        maxDate={todayISO()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});
