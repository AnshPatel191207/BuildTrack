import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { leadService } from '@/services/erpService';
import {
  LEAD_STAGE_OPTIONS,
  optionLabel,
} from '@/constants/options';
import { LEAD_STAGE_TONES } from '@/constants/status';
import { formatDateShort, todayISO } from '@/lib/format';

export default function LeadDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { colors, spacing } = theme;

  const [lead, setLead] = useState<Awaited<ReturnType<typeof leadService.get>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stageSheet, setStageSheet] = useState(false);
  const [followUpSheet, setFollowUpSheet] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLead(await leadService.get(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lead.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateStage = (stage: string) => {
    setBusy(true);
    (async () => {
      try {
        await leadService.update(id, stage === 'lost' ? { stage, lostReason: 'Lost via app' } : { stage });
        showToast('Stage updated');
        bump(DATA_KEYS.leads);
        await load();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed', 'error');
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading && !lead) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Lead" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} style={{ borderRadius: 14 }} />
          ))}
        </View>
      </View>
    );
  }
  if (error && !lead) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Lead" onBack={() => router.back()} />
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }
  if (!lead) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={lead.name}
        subtitle={[lead.phone, lead.interestedIn ?? undefined].filter(Boolean).join(' · ')}
        onBack={() => router.back()}
        right={<Badge label={optionLabel(LEAD_STAGE_OPTIONS, lead.stage)} tone={LEAD_STAGE_TONES[lead.stage]} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        <Button
          label="Call lead"
          variant="secondary"
          icon="call-outline"
          onPress={() => void import('react-native').then(({ Linking }) => Linking.openURL(`tel:${lead.phone}`))}
          style={{ marginTop: spacing.md }}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button label="Change stage" size="sm" variant="secondary" disabled={busy} onPress={() => setStageSheet(true)} style={{ flex: 1 }} />
          <Button label="Add follow-up" size="sm" variant="secondary" disabled={busy} onPress={() => setFollowUpSheet(true)} style={{ flex: 1 }} />
        </View>

        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
          Follow-ups
        </Text>
        {lead.followUps.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13.5, marginTop: 6 }}>No follow-ups yet.</Text>
        ) : (
          [...lead.followUps].reverse().map((f, index) => (
            <View
              key={String(f._id ?? index)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderRadius: 10,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                padding: 11,
                marginTop: 7,
                gap: 9,
              }}
            >
              <Badge
                label={f.done ? 'Done' : formatDateShort(f.date)}
                tone={f.done ? 'success' : 'warning'}
              />
              <Text numberOfLines={1} style={{ flex: 1, color: colors.textMuted, fontSize: 12.5 }}>
                {f.note ?? 'Follow-up'}
              </Text>
            </View>
          ))
        )}

        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
          Notes
        </Text>
        {lead.notes.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13.5, marginTop: 6 }}>No notes yet.</Text>
        ) : (
          lead.notes.map((note, index) => (
            <Text key={index} style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>
              • {note.text}
              {typeof note.author === 'object' && note.author ? ` — ${note.author.name}` : ''}
            </Text>
          ))
        )}
      </ScrollView>

      <SelectSheet
        visible={stageSheet}
        onClose={() => setStageSheet(false)}
        title="Move to stage"
        options={LEAD_STAGE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
        value={lead.stage}
        onSelect={(v) => {
          setStageSheet(false);
          updateStage(v);
        }}
      />
      <SelectSheet
        visible={followUpSheet}
        onClose={() => setFollowUpSheet(false)}
        title="Quick schedule"
        options={[
          { label: 'In 2 days', value: '2' },
          { label: 'Next week', value: '7' },
          { label: 'Next month', value: '30' },
        ]}
        value=""
        onSelect={(v) => {
          setFollowUpSheet(false);
          setBusy(true);
          (async () => {
            try {
              const d = new Date();
              d.setDate(d.getDate() + Number(v));
              await leadService.scheduleFollowUp(
                id,
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                'Follow-up',
              );
              showToast('Follow-up scheduled');
              bump(DATA_KEYS.leads);
              await load();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Failed', 'error');
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </View>
  );
}





