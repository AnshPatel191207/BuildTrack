import React, { useCallback, useState } from 'react';
import {
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
import { UploadProgress } from '@/components/ui/UploadProgress';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { usePendingMediaStore } from '@/stores/pendingMediaStore';
import { reportSchema, type ReportFormInput } from '@/schemas';
import { reportService, type ReportInput } from '@/services/projectDataService';
import { photoService, validateMediaFile } from '@/services/photoService';
import { WEATHER_OPTIONS } from '@/constants/options';
import { formatDate, todayISO } from '@/lib/format';

interface Attachment {
  uri: string;
  mimeType: string;
  durationSeconds?: number;
  kind: 'image' | 'video' | 'document';
}

export default function ReportModal() {
  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const params = useLocalSearchParams<{ projectId?: string; date?: string }>();
  const { colors, spacing } = theme;

  const form = useForm<ReportFormInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      date: params.date ?? todayISO(),
      weather: 'sunny',
      workersPresent: undefined as unknown as number,
      workCompleted: '',
      summary: '',
      materialsUsed: '',
      issues: '',
      safetyNotes: '',
      tomorrowPlan: '',
    },
  });
  const submitting = form.formState.isSubmitting;
  const date = form.watch('date');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);

  const projectId = params.projectId!;

  // Camera screen hands captures back through pendingMediaStore.
  useFocusEffect(
    useCallback(() => {
      const photo = usePendingMediaStore.getState().consume(`report:photo`);
      if (photo) addAttachment({ ...photo, kind: 'image' });
      const video = usePendingMediaStore.getState().consume(`report:video`);
      if (video) {
        addAttachment({
          uri: video.uri,
          mimeType: video.mimeType || 'video/mp4',
          durationSeconds: video.durationSeconds,
          kind: 'video',
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  function addAttachment(file: {
    uri: string;
    mimeType: string;
    durationSeconds?: number;
    kind: 'image' | 'video' | 'document';
  }) {
    const problem = validateMediaFile({ mimeType: file.mimeType });
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setAttachments((prev) => (prev.length >= 10 ? prev : [...prev, file]));
  }

  const openCameraForReport = (mode: 'photo' | 'video') => {
    router.push({
      pathname: '/camera',
      params: { mode, projectId, requestId: mode === 'video' ? 'report:video' : 'report:photo' },
    });
  };

  const onSubmit = async (values: ReportFormInput) => {
    // Upload attachments first so the report links real media ids.
    const photoIds: string[] = [];
    const videoIds: string[] = [];
    try {
      for (let i = 0; i < attachments.length; i++) {
        const a = attachments[i];
        setUploading(i);
        const media = await photoService.uploadPhoto(
          { uri: a.uri, mimeType: a.mimeType, durationSeconds: a.durationSeconds },
          {
            projectId,
            category: 'progress',
            description: `Daily report ${values.date}`,
          },
        );
        if (media.kind === 'video') videoIds.push(media._id);
        else photoIds.push(media._id);
      }
      setUploading(null);

      const payload: ReportInput = {
        projectId,
        date: values.date,
        weather: values.weather,
        workersPresent: Number(values.workersPresent) || 0,
        workCompleted: values.workCompleted.trim(),
        summary: values.summary?.trim() || undefined,
        materialsUsed: values.materialsUsed?.trim() || undefined,
        issues: values.issues?.trim() || undefined,
        safetyNotes: values.safetyNotes?.trim() || undefined,
        tomorrowPlan: values.tomorrowPlan?.trim() || undefined,
      };
      if (photoIds.length) payload.photos = photoIds;
      if (videoIds.length) payload.videos = videoIds;

      await reportService.createReport(payload);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Daily report saved');
      bump(DATA_KEYS.reports);
      bump(DATA_KEYS.dashboard);
      router.back();
    } catch (err) {
      // Duplicate report for the same day is the common failure.
      showToast(err instanceof Error ? err.message : 'Could not save report', 'error');
    } finally {
      setUploading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader
          title="Daily site report"
          subtitle="Two minutes now saves disputes later"
          onBack={() => router.back()}
        />
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Pressable
                  onPress={() => setDatePickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Report date"
                >
                  <View pointerEvents="none">
                    <FormInput
                      control={form.control}
                      name="date"
                      label="Date"
                      editable={false}
                      value={formatDate(date)}
                      error={form.formState.errors.date?.message}
                      required
                    />
                  </View>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  control={form.control}
                  name="workersPresent"
                  label="Workers present"
                  placeholder="0"
                  keyboardType="numeric"
                  required
                />
              </View>
            </View>
            <SelectField
              label="Weather"
              options={[...WEATHER_OPTIONS]}
              value={form.watch('weather')}
              onChange={(v) => form.setValue('weather', v as ReportFormInput['weather'], { shouldValidate: true })}
              required
            />
            <FormInput
              control={form.control}
              name="workCompleted"
              label="Work completed today"
              placeholder="e.g. Column casting done for 2nd floor, curing started"
              multiline
              required
            />
            <FormInput
              control={form.control}
              name="materialsUsed"
              label="Materials used (optional)"
              placeholder="e.g. 40 bags cement, 2 trips sand"
              multiline
            />
            <FormInput
              control={form.control}
              name="issues"
              label="Issues / delays (optional)"
              placeholder="Anything that blocked progress"
              multiline
            />
            <FormInput
              control={form.control}
              name="safetyNotes"
              label="Safety notes (optional)"
              placeholder="Incidents, near-misses, PPE checks"
              multiline
            />
            <FormInput
              control={form.control}
              name="tomorrowPlan"
              label="Tomorrow's plan (optional)"
              placeholder="What the crew should pick up first"
              multiline
            />

            {/* Attachments */}
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 8 }}>
                Attach progress photos & videos
              </Text>
              {attachments.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {attachments.map((a, idx) => (
                    <Pressable
                      key={`${a.uri}-${idx}`}
                      onPress={() =>
                        setAttachments((prev) => prev.filter((_, i) => i !== idx))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Remove attachment ${idx + 1}`}
                      style={{
                        width: 74,
                        height: 74,
                        borderRadius: 10,
                        marginRight: 8,
                        overflow: 'hidden',
                        backgroundColor: colors.surfaceAlt,
                      }}
                    >
                      {a.kind === 'image' ? (
                        <Image source={{ uri: a.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ alignItems: 'center', justifyContent: 'center', height: '100%', gap: 3 }}>
                          <Ionicons name="videocam" size={20} color={colors.primary} />
                          <Text style={{ color: colors.textFaint, fontSize: 9.5 }}>video</Text>
                        </View>
                      )}
                      <View
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="close" size={12} color="#fff" />
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {uploading != null ? (
                <UploadProgress
                  fraction={(uploading + 1) / Math.max(attachments.length, 1)}
                  label={`Uploading attachment ${uploading + 1} of ${attachments.length}…`}
                />
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label="Photo"
                    variant="secondary"
                    size="sm"
                    onPress={() => openCameraForReport('photo')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Video"
                    variant="secondary"
                    size="sm"
                    onPress={() => openCameraForReport('video')}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </View>

            <Button
              label={uploading != null ? 'Uploading…' : 'Save daily report'}
              size="lg"
              loading={submitting || uploading != null}
              disabled={uploading != null}
              onPress={form.handleSubmit(onSubmit)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </ScrollView>

      <DatePickerSheet
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={date || null}
        onChange={(iso) => form.setValue('date', iso, { shouldValidate: true })}
        title="Report date"
        maxDate={todayISO()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});
