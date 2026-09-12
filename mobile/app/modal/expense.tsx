import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { usePendingMediaStore } from '@/stores/pendingMediaStore';
import { expenseSchema, type ExpenseInput } from '@/schemas';
import { expenseService } from '@/services/projectDataService';
import { projectService } from '@/services/projectService';
import { photoService, validateMediaFile } from '@/services/photoService';
import {
  EXPENSE_CATEGORY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from '@/constants/options';
import { formatDate, todayISO } from '@/lib/format';

export default function ExpenseModal() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const params = useLocalSearchParams<{ id?: string; projectId?: string }>();
  const isEdit = Boolean(params.id);
  const { colors, spacing } = theme;

  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);
  const [loaded, setLoaded] = useState(!isEdit);
  const [deleting, setDeleting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ uri: string; mimeType: string } | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const openCameraForReceipt = (mode: 'photo' | 'document') => {
    router.push({
      pathname: '/camera',
      params: { mode, requestId: 'expense:receipt' },
    });
  };

  // Camera hands the receipt capture back through pendingMediaStore.
  useFocusEffect(
    useCallback(() => {
      const media = usePendingMediaStore.getState().consume('expense:receipt');
      if (!media) return;
      const problem = validateMediaFile({ mimeType: media.mimeType });
      if (problem) {
        showToast(problem, 'error');
        return;
      }
      setReceipt({ uri: media.uri, mimeType: media.mimeType });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      amount: undefined as unknown as number,
      category: 'materials',
      paymentMethod: 'cash',
      date: todayISO(),
      projectId: params.projectId ?? '',
      description: '',
    },
  });
  const submitting = form.formState.isSubmitting;
  const date = form.watch('date');

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) => setProjects(list.items.map((p) => ({ label: p.name, value: p._id }))))
      .catch(() => {});
    if (params.id) {
      expenseService
        .getExpense(params.id)
        .then((e) => {
          form.reset({
            title: e.title,
            amount: e.amount,
            category: e.category,
            paymentMethod: e.paymentMethod,
            date: e.date.slice(0, 10),
            projectId:
              typeof e.projectId === 'object' ? e.projectId._id : String(e.projectId),
            description: e.description ?? '',
          });
        })
        .catch((err) =>
          showToast(err instanceof Error ? err.message : 'Could not load expense', 'error'),
        )
        .finally(() => setLoaded(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: ExpenseInput) => {
    try {
      // Upload the receipt scan first so the expense links real media.
      let receiptImage: { url: string; publicId: string | null } | undefined;
      if (receipt) {
        setUploadingReceipt(true);
        const media = await photoService.uploadPhoto(
          { uri: receipt.uri, mimeType: receipt.mimeType },
          {
            projectId:
              typeof values.projectId === 'string' && values.projectId
                ? values.projectId
                : params.projectId!,
            category: 'material',
            description: `Receipt — ${values.title}`,
          },
        );
        receiptImage = { url: media.url, publicId: media.publicId ?? null };
        setUploadingReceipt(false);
      }

      if (isEdit) {
        await expenseService.updateExpense(params.id!, { ...values, receiptImage });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast('Expense updated');
      } else {
        await expenseService.createExpense({ ...values, receiptImage });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast(`Expense of ₹${Math.round(values.amount).toLocaleString('en-IN')} saved`);
      }
      bump(DATA_KEYS.expenses);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save expense', 'error');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete this expense?', 'Project spend total will be updated.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          expenseService
            .deleteExpense(params.id!)
            .then(() => {
              showToast('Expense deleted');
              bump(DATA_KEYS.expenses);
              bump(DATA_KEYS.dashboard);
              router.back();
            })
            .catch((err) =>
              showToast(err instanceof Error ? err.message : 'Could not delete', 'error'),
            )
            .finally(() => setDeleting(false));
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader
          title={isEdit ? 'Edit expense' : 'Add expense'}
          subtitle={isEdit ? undefined : 'Log site spending as it happens'}
          onBack={() => router.back()}
        />
        {loaded ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
            <View style={{ gap: spacing.md }}>
              <SelectField
                label="Project"
                placeholder={projects.length ? 'Choose a project' : 'Loading projects…'}
                options={projects}
                value={form.watch('projectId')}
                onChange={(v) => form.setValue('projectId', v, { shouldValidate: true })}
                error={form.formState.errors.projectId?.message}
                disabled={Boolean(!isEdit && params.projectId)}
                required
              />
              <FormInput
                control={form.control}
                name="title"
                label="What was it for?"
                placeholder="e.g. Cement 50 bags — UltraTech"
                autoCapitalize="sentences"
                required
              />
              <FormInput
                control={form.control}
                name="amount"
                label="Amount"
                placeholder="0"
                keyboardType="numeric"
                prefix="₹"
                required
              />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Category"
                    options={[...EXPENSE_CATEGORY_OPTIONS]}
                    value={form.watch('category')}
                    onChange={(v) => form.setValue('category', v as ExpenseInput['category'], { shouldValidate: true })}
                    error={form.formState.errors.category?.message}
                    required
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Paid via"
                    options={[...PAYMENT_METHOD_OPTIONS]}
                    value={form.watch('paymentMethod')}
                    onChange={(v) => form.setValue('paymentMethod', v as ExpenseInput['paymentMethod'], { shouldValidate: true })}
                    error={form.formState.errors.paymentMethod?.message}
                    required
                  />
                </View>
              </View>
              <Pressable
                onPress={() => setDatePickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Expense date"
                style={styles.dateField}
              >
                <View pointerEvents="none">
                  <FormInput
                    control={form.control}
                    name="date"
                    label="Date"
                    editable={false}
                    value={date ? formatDate(date) : ''}
                    error={form.formState.errors.date?.message}
                    required
                  />
                </View>
              </Pressable>

              <FormInput
                control={form.control}
                name="description"
                label="Notes (optional)"
                placeholder="Invoice no., paid-to name…"
                multiline
              />

              {/* Receipt attach */}
              <View>
                <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 8 }}>
                  Receipt / bill proof
                </Text>
                {receipt ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: 10,
                      padding: 10,
                      gap: 10,
                    }}
                  >
                    {receipt.mimeType.startsWith('image/') ? (
                      <Image
                        source={{ uri: receipt.uri }}
                        resizeMode="cover"
                        style={{ width: 46, height: 46, borderRadius: 8 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 8,
                          backgroundColor: colors.primaryMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="document-text" size={20} color={colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 13.5 }}>
                        {receipt.mimeType === 'application/pdf' ? 'Scanned PDF bill' : 'Receipt photo'}
                      </Text>
                      <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>Attached to this expense</Text>
                    </View>
                    <Pressable
                      onPress={() => setReceipt(null)}
                      accessibilityLabel="Remove receipt"
                      hitSlop={8}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.dangerSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      label="Snap photo"
                      variant="secondary"
                      size="sm"
                      onPress={() => openCameraForReceipt('photo')}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Scan bill (PDF)"
                      variant="secondary"
                      size="sm"
                      onPress={() => openCameraForReceipt('document')}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </View>

              <Button
                label={uploadingReceipt ? 'Uploading receipt…' : isEdit ? 'Save changes' : 'Save expense'}
                size="lg"
                loading={submitting || uploadingReceipt}
                disabled={uploadingReceipt}
                onPress={form.handleSubmit(onSubmit)}
                style={{ marginTop: spacing.sm }}
              />
              {isEdit ? (
                <Button
                  label="Delete expense"
                  variant="ghost"
                  loading={deleting}
                  onPress={confirmDelete}
                />
              ) : null}
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
        value={date || null}
        onChange={(iso) => form.setValue('date', iso, { shouldValidate: true })}
        title="Expense date"
        maxDate={todayISO()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dateField: {},
});
