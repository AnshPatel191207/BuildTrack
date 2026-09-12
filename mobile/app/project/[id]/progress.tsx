import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { progressService } from '@/services/erpService';
import { MILESTONE_STATUS_TONES, STAGE_STATUS_TONES } from '@/constants/status';
import { formatDateShort } from '@/lib/format';

export default function ProgressScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const projectId = String(params.id);
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { colors, spacing } = theme;

  const [data, setData] = useState<Awaited<ReturnType<typeof progressService.dashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageSheetFor, setStageSheetFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(!data);
    try {
      setData(await progressService.dashboard(projectId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load progress.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const setStageProgress = async (stageId: string, percent: number) => {
    setStageSheetFor(null);
    try {
      await progressService.updateStage(stageId, {
        progressPercentage: percent,
        status:
          percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : undefined,
      });
      showToast('Stage updated');
      bump(DATA_KEYS.progress);
      bump(DATA_KEYS.projects);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  };

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Progress" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={90} style={{ borderRadius: 14 }} />
          ))}
        </View>
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Progress" onBack={() => router.back()} />
        <ErrorState message={error} offline onRetry={() => void load()} />
      </View>
    );
  }
  if (!data) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Progress"
        subtitle={params.name ?? data.project.name}
        onBack={() => router.back()}
        right={<Badge label={`${Math.round(data.project.progressPercentage)}% overall`} tone="orange" />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        {/* Blocks & floors */}
        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md }}>
          Blocks &amp; floors
        </Text>
        {data.blocks.length === 0 ? (
          <EmptyState icon="business-outline" title="No blocks defined" message="Add structure levels to track per-block progress." />
        ) : (
          data.blocks.map((block) => (
            <View
              key={block._id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                marginTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: 15 }}>
                  {block.name}
                </Text>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>
                  {Math.round(block.progressPercentage ?? 0)}%
                </Text>
              </View>
              <ProgressBar
                fraction={(block.progressPercentage ?? 0) / 100}
                style={{ marginTop: 8 }}
              />
              {(block.children ?? []).map((floor: any) => (
                <View key={floor._id} style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, color: colors.textMuted, fontWeight: '700', fontSize: 13 }}>
                      {floor.name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
                      {Math.round(floor.progressPercentage ?? 0)}%
                    </Text>
                  </View>
                  <ProgressBar fraction={(floor.progressPercentage ?? 0) / 100} style={{ marginTop: 5 }} height={4} />
                </View>
              ))}
            </View>
          ))
        )}

        {/* Construction stages */}
        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
          Construction stages — tap a stage to update
        </Text>
        <View style={{ gap: 7, marginTop: 8 }}>
          {data.stages.map((stage) => (
            <Pressable
              key={stage._id}
              onPress={() => setStageSheetFor(stage._id)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderRadius: 11,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                padding: 11,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 13.5 }}>
                    {stage.label ?? stage.name.replace(/_/g, ' ')}
                  </Text>
                  {stage.isDelayed ? <Badge label="Late" tone="danger" /> : null}
                </View>
                <ProgressBar fraction={(stage.progressPercentage ?? 0) / 100} style={{ marginTop: 6 }} height={4} />
              </View>
              <Badge
                label={`${Math.round(stage.progressPercentage ?? 0)}%`}
                tone={STAGE_STATUS_TONES[stage.status]}
                style={{ marginLeft: 9 }}
              />
            </Pressable>
          ))}
        </View>

        {/* Milestones inline */}
        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
          Milestones
        </Text>
        {data.milestones.map((milestone) => (
          <Row
            key={milestone._id}
            title={milestone.name}
            subtitle={`Due ${formatDateShort(milestone.dueDate)}`}
            badgeLabel={milestone.effectiveStatus ?? milestone.status}
            tone={MILESTONE_STATUS_TONES[milestone.effectiveStatus ?? milestone.status]}
          />
        ))}
      </ScrollView>

      <SelectSheet
        visible={stageSheetFor != null}
        onClose={() => setStageSheetFor(null)}
        title="Stage progress"
        options={[0, 10, 25, 50, 75, 90, 100].map((p) => ({
          label: `${p}% complete`,
          value: String(p),
        }))}
        value=""
        onSelect={(v) => {
          if (stageSheetFor) void setStageProgress(stageSheetFor, Number(v));
        }}
      />
    </View>
  );
}

function Row({
  title,
  subtitle,
  badgeLabel,
  tone,
}: {
  title: string;
  subtitle?: string;
  badgeLabel: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';
}) {
  const theme = useTheme();
  const { colors } = theme;
  void colors;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 9,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#00000011',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '600' }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: colors.textFaint, fontSize: 11.5, marginTop: 1 }}>{subtitle}</Text>
        ) : null}
      </View>
      <Badge label={badgeLabel} tone={tone} />
    </View>
  );
}




