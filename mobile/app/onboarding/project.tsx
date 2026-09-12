import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { projectSchema, type ProjectFormInput } from '@/schemas';
import { projectService } from '@/services/projectService';
import { PROJECT_TYPE_OPTIONS } from '@/constants/options';
import { formatDate } from '@/lib/format';

export default function FirstProjectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { colors, radius, spacing } = theme;

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      clientName: '',
      clientPhone: '',
      location: '',
      projectType: 'residential',
      startDate: '',
      expectedEndDate: '',
      budget: undefined as unknown as number,
      description: '',
    },
  });
  const submitting = form.formState.isSubmitting;
  const [creating, setCreating] = useState(false);

  const startDate = form.watch('startDate');
  const endDate = form.watch('expectedEndDate');
  const [dateField, setDateField] = useState<'start' | 'end' | null>(null);

  const onSubmit = async (values: ProjectFormInput) => {
    setCreating(true);
    try {
      await projectService.createProject({
        name: values.name.trim(),
        location: values.location.trim(),
        projectType: values.projectType,
        startDate: values.startDate,
        budget: Number(values.budget) || 0,
        clientName: values.clientName?.trim() || undefined,
        clientPhone: values.clientPhone || undefined,
        expectedEndDate: values.expectedEndDate || undefined,
        description: values.description?.trim() || undefined,
      });
      bump(DATA_KEYS.projects);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/onboarding/complete');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create project', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxl * 1.4, paddingBottom: spacing.xl }}>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
            <View style={[styles.stepLine, { backgroundColor: colors.primary }]} />
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 13 }}>2</Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: colors.borderStrong }]} />
            <View style={[styles.stepDot, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="checkmark" size={14} color={colors.textMuted} />
            </View>
          </View>

          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.lg, letterSpacing: -0.4 }}>
            Add your first site
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14.5, marginTop: 6 }}>
            Track expenses, workers and materials per project. You can skip and add one later.
          </Text>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <FormInput
              control={form.control}
              name="name"
              label="Project name"
              placeholder="e.g. Sunrise Residency — Tower A"
              autoCapitalize="words"
              required
            />
            <FormInput
              control={form.control}
              name="location"
              label="Location"
              placeholder="Site address or area"
              required
            />
            <SelectField
              label="Project type"
              options={[...PROJECT_TYPE_OPTIONS]}
              value={form.watch('projectType')}
              onChange={(v) => form.setValue('projectType', v as ProjectFormInput['projectType'])}
              error={form.formState.errors.projectType?.message}
              required
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => setDateField('start')} accessibilityRole="button" accessibilityLabel="Start date">
                  <View pointerEvents="none">
                    <FormInput
                      control={form.control}
                      name="startDate"
                      label="Start date"
                      placeholder="Pick date"
                      editable={false}
                      value={startDate ? formatDate(startDate) : ''}
                      error={form.formState.errors.startDate?.message}
                      required
                    />
                  </View>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => setDateField('end')} accessibilityRole="button" accessibilityLabel="Expected end date">
                  <View pointerEvents="none">
                    <FormInput
                      control={form.control}
                      name="expectedEndDate"
                      label="Expected end"
                      placeholder="Optional"
                      editable={false}
                      value={endDate ? formatDate(endDate) : ''}
                      error={form.formState.errors.expectedEndDate?.message}
                    />
                  </View>
                </Pressable>
              </View>
            </View>
            <FormInput
              control={form.control}
              name="budget"
              label="Budget (₹)"
              placeholder="e.g. 2500000"
              keyboardType="numeric"
              prefix="₹"
              hint="Total sanctioned amount for this project"
              required
            />

            <Button
              label="Create project"
              size="lg"
              loading={submitting || creating}
              onPress={form.handleSubmit(onSubmit)}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              label="Skip — I'll add sites later"
              variant="ghost"
              onPress={() => router.replace('/onboarding/complete')}
            />
          </View>
        </View>
      </ScrollView>

      <DatePickerSheet
        visible={dateField === 'start'}
        onClose={() => setDateField(null)}
        value={startDate || null}
        onChange={(iso) => form.setValue('startDate', iso, { shouldValidate: true })}
        title="Start date"
      />
      <DatePickerSheet
        visible={dateField === 'end'}
        onClose={() => setDateField(null)}
        value={endDate || null}
        onChange={(iso) => form.setValue('expectedEndDate', iso, { shouldValidate: true })}
        title="Expected end date"
        minDate={startDate || undefined}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    borderRadius: 1,
  },
});
