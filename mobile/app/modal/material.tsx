import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { materialSchema, type MaterialFormInput } from '@/schemas';
import { materialService } from '@/services/materialService';
import {
  MATERIAL_CATEGORY_OPTIONS,
  MATERIAL_UNIT_OPTIONS,
} from '@/constants/options';

export default function MaterialModal() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const params = useLocalSearchParams<{ projectId?: string }>();
  const { colors, spacing } = theme;

  const form = useForm<MaterialFormInput>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: '',
      category: 'cement',
      unit: 'bag',
      currentStock: 0,
      minimumStock: 0,
      averagePrice: 0,
      supplier: '',
    },
  });
  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: MaterialFormInput) => {
    try {
      await materialService.createMaterial({
        projectId: params.projectId!,
        name: values.name.trim(),
        category: values.category,
        unit: values.unit,
        currentStock: Number(values.currentStock) || 0,
        minimumStock: Number(values.minimumStock) || 0,
        averagePrice: Number(values.averagePrice) || 0,
        supplier: values.supplier?.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`${values.name.trim()} added to materials`);
      bump(DATA_KEYS.materials);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save material', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader
          title="Add material"
          subtitle="Track stock so you never run dry mid-slab"
          onBack={() => router.back()}
        />
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ gap: spacing.md }}>
            <FormInput
              control={form.control}
              name="name"
              label="Material name"
              placeholder="e.g. OPC Cement 53 grade"
              autoCapitalize="words"
              required
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1.2 }}>
                <SelectField
                  label="Category"
                  options={[...MATERIAL_CATEGORY_OPTIONS]}
                  value={form.watch('category')}
                  onChange={(v) => form.setValue('category', v as MaterialFormInput['category'], { shouldValidate: true })}
                  error={form.formState.errors.category?.message}
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField
                  label="Unit"
                  options={[...MATERIAL_UNIT_OPTIONS]}
                  value={form.watch('unit')}
                  onChange={(v) => form.setValue('unit', v as MaterialFormInput['unit'], { shouldValidate: true })}
                  error={form.formState.errors.unit?.message}
                  required
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FormInput
                  control={form.control}
                  name="currentStock"
                  label="Opening stock"
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  control={form.control}
                  name="minimumStock"
                  label="Alert me below"
                  placeholder="e.g. 20"
                  keyboardType="numeric"
                />
              </View>
            </View>
            <FormInput
              control={form.control}
              name="averagePrice"
              label="Average price per unit"
              placeholder="e.g. 385"
              keyboardType="numeric"
              prefix="₹"
            />
            <FormInput
              control={form.control}
              name="supplier"
              label="Regular supplier (optional)"
              placeholder="Shop or vendor name"
              autoCapitalize="words"
            />

            <Button
              label="Save material"
              size="lg"
              loading={submitting}
              onPress={form.handleSubmit(onSubmit)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});
