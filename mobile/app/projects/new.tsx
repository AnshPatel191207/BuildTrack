import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { MapCard } from '@/components/ui/MapCard';
import { Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { projectSchema, type ProjectFormInput } from '@/schemas';
import { projectService } from '@/services/projectService';
import { useLocation } from '@/hooks/useLocation';
import { PROJECT_TYPE_OPTIONS, PROJECT_STATUS_OPTIONS } from '@/constants/options';
import { formatDate } from '@/lib/format';

export default function NewProjectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const params = useLocalSearchParams<{ editId?: string }>();
  const isEdit = Boolean(params.editId);
  const { colors, spacing } = theme;

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
  const startDate = form.watch('startDate');
  const endDate = form.watch('expectedEndDate');
  const [dateField, setDateField] = useState<'start' | 'end' | null>(null);
  const [status, setStatus] = useState<string>('active');
  const [loaded, setLoaded] = useState(!isEdit);
  const [sitePin, setSitePin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [siteRadius, setSiteRadius] = useState(150);
  const { locateNow, locating, reverseGeocode } = useLocation();

  const fillFromGps = async () => {
    const fix = await locateNow();
    if (!fix) {
      showToast('Could not get your location — check permissions', 'error');
      return;
    }
    setSitePin({ latitude: fix.latitude, longitude: fix.longitude });
    const addr = await reverseGeocode(fix.latitude, fix.longitude);
    if (addr && !form.getValues('location')) {
      form.setValue('location', addr);
    }
    showToast('Site pinned from GPS');
  };

  useEffect(() => {
    if (!params.editId) return;
    projectService
      .getProject(params.editId)
      .then((p) => {
        form.reset({
          name: p.name,
          clientName: p.clientName ?? '',
          clientPhone: p.clientPhone ?? '',
          location: p.location ?? '',
          projectType: p.projectType,
          startDate: p.startDate.slice(0, 10),
          expectedEndDate: p.expectedEndDate?.slice(0, 10) ?? '',
          budget: p.budget,
          description: p.description ?? '',
        });
        setStatus(p.status);
        if (p.latitude != null && p.longitude != null) {
          setSitePin({ latitude: p.latitude, longitude: p.longitude });
          setSiteRadius(p.siteRadiusMeters ?? 150);
        }
      })
      .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load project', 'error'))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editId]);

  const onSubmit = async (values: ProjectFormInput) => {
    try {
      const geo =
        sitePin != null
          ? {
              latitude: Number(sitePin.latitude.toFixed(6)),
              longitude: Number(sitePin.longitude.toFixed(6)),
              siteRadiusMeters: siteRadius,
            }
          : {};
      if (isEdit) {
        await projectService.updateProject(params.editId!, {
          name: values.name.trim(),
          location: values.location.trim(),
          projectType: values.projectType,
          startDate: values.startDate,
          budget: Number(values.budget) || 0,
          status,
          clientName: values.clientName?.trim() || undefined,
          clientPhone: values.clientPhone || undefined,
          expectedEndDate: values.expectedEndDate || undefined,
          description: values.description?.trim() || undefined,
          ...geo,
        });
        showToast('Project updated');
      } else {
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
          ...geo,
        });
        if (sitePin) {
          showToast('Project created — GPS check-in enabled');
        }
      }
      bump(DATA_KEYS.projects);
      bump(DATA_KEYS.dashboard);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save project', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader title={isEdit ? 'Edit project' : 'New project'} onBack={() => router.back()} />
        {loaded ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ gap: spacing.md }}>
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

            {/* GPS site pin */}
            {sitePin ? (
              <MapCard
                latitude={sitePin.latitude}
                longitude={sitePin.longitude}
                title="Site pin"
                radiusMeters={siteRadius}
                onPress={() => setSitePin(null)}
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label={locating ? 'Locating…' : sitePin ? 'Re-capture GPS' : 'Use my location'}
                variant="secondary"
                size="sm"
                loading={locating}
                onPress={() => void fillFromGps()}
                style={{ flex: 1 }}
              />
              {sitePin ? (
                <Button
                  label="Remove pin"
                  variant="ghost"
                  size="sm"
                  onPress={() => setSitePin(null)}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
            {sitePin ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: colors.textFaint, fontSize: 12 }}>Geofence:</Text>
                {[100, 150, 250, 500].map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setSiteRadius(r)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: siteRadius === r }}
                    style={{
                      backgroundColor: siteRadius === r ? colors.primary : colors.surfaceAlt,
                      borderRadius: 999,
                      paddingHorizontal: 11,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: siteRadius === r ? colors.onPrimary : colors.textMuted,
                        fontSize: 11.5,
                        fontWeight: '700',
                      }}
                    >
                      {r}m
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FormInput
                  control={form.control}
                  name="clientName"
                  label="Client name"
                  placeholder="Optional"
                  autoCapitalize="words"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  control={form.control}
                  name="clientPhone"
                  label="Client phone"
                  placeholder="Optional"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
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
              required
            />
            {isEdit ? (
              <SelectField
                label="Status"
                options={[...PROJECT_STATUS_OPTIONS]}
                value={status}
                onChange={setStatus}
              />
            ) : null}
            <FormInput
              control={form.control}
              name="description"
              label="Description"
              placeholder="Scope, notes… (optional)"
              multiline
            />

            <Button
              label={isEdit ? 'Save changes' : 'Create project'}
              size="lg"
              loading={submitting}
              onPress={form.handleSubmit(onSubmit)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Skeleton height={400} style={{ borderRadius: 12 }} />
          </View>
        )}
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
