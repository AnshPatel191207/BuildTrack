import React from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { companyService } from '@/services/companyService';
import { projectService } from '@/services/projectService';
import { STATUS_TONES, phaseLabel } from '@/constants/status';
import type { ProjectDashboard } from '@/types';
import { formatDate, formatCompactINR, formatINR, relativeTime, todayISO, daysUntil } from '@/lib/format';

export default function ProjectOverviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const dashVersion = useDataVersionKey(DATA_KEYS.dashboard);
  const projVersion = useDataVersionKey(DATA_KEYS.projects);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const fetcher = React.useCallback(
    () => companyService.getProjectDashboard(id!),
    [id, dashVersion, projVersion],
  );
  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource<ProjectDashboard>(fetcher, [fetcher]);

  if (!id) return null;

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: spacing.lg, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={96} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Project" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg }}>
          <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
        </View>
      </View>
    );
  }

  if (!data) return null;
  const { project, financial, workforce, materials, tasks } = data;
  const days = daysUntil(project.expectedEndDate);

  const confirmDeleteProject = () => {
    Alert.alert(
      `Delete ${project.name}?`,
      'All expenses, attendance and materials linked to this project will also be deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            projectService
              .deleteProject(project._id)
              .then(() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                showToast('Project deleted');
                router.replace('/(tabs)/projects');
              })
              .catch((err) =>
                showToast(err instanceof Error ? err.message : 'Could not delete project', 'error'),
              );
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={project.name}
        subtitle={[project.clientName, project.location].filter(Boolean).join(' · ')}
        onBack={() => router.back()}
        right={
          <>
            <Pressable
              onPress={() => router.push({ pathname: '/projects/new', params: { editId: project._id } })}
              accessibilityLabel="Edit project"
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={confirmDeleteProject}
              accessibilityLabel="Delete project"
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.dangerSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </>
        }
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {/* Status + progress */}
        <Card style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm }} padded>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Badge label={project.status.replace('_', ' ')} tone={STATUS_TONES[project.status]} dot />
            <Text style={{ color: colors.textFaint, fontSize: 12 }}>
              Started {formatDate(project.startDate)}
              {days != null ? (days >= 0 ? ` · ${days}d left` : ` · ${Math.abs(days)}d over`) : ''}
            </Text>
          </View>
          <View style={{ marginTop: 12 }}>
            <ProgressBar fraction={project.progressPercentage / 100} showLabel label={phaseLabel(project.progressPercentage)} />
          </View>
        </Card>

        {/* Financials */}
        <SectionTitle text="Money" />
        <Card
          style={[
            styles.finCard,
            { marginHorizontal: spacing.lg },
            financial.overBudget && { borderColor: colors.dangerSoft },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: '600' }}>
                Spent of {formatCompactINR(financial.budget)}
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 }}>
                {formatINR(financial.spent)}
              </Text>
            </View>
            {financial.overBudget ? (
              <Badge label={`Over by ${formatCompactINR(financial.overBy)}`} tone="danger" />
            ) : (
              <Badge label={`${formatCompactINR(Math.max(0, financial.remaining))} left`} tone="orange" />
            )}
          </View>
          <View style={{ marginTop: 12 }}>
            <ProgressBar
              fraction={financial.utilization / 100}
              tone={financial.utilization >= 95 ? 'danger' : financial.utilization >= 80 ? 'warning' : 'primary'}
            />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 6 }}>
              {Math.round(financial.utilization)}% of budget used · est. labor cost today {formatCompactINR(workforce.estimatedLaborCost)}
            </Text>
          </View>
        </Card>

        {/* Quick actions */}
        <SectionTitle text="Site tools" />
        <View style={[styles.toolsGrid, { paddingHorizontal: spacing.lg }]}>
          <ToolTile icon="people-outline" label="Attendance" hint={`${workforce.present}/${workforce.totalWorkers} present`} onPress={() => router.push(`/project/${id}/attendance`)} />
          <ToolTile icon="cube-outline" label="Materials" hint={materials.lowStockCount > 0 ? `${materials.lowStockCount} low stock` : 'Stock healthy'} warn={materials.lowStockCount > 0} onPress={() => router.push(`/project/${id}/materials`)} />
          <ToolTile icon="wallet-outline" label="Expenses" onPress={() => router.push(`/project/${id}/expenses`)} />
          <ToolTile icon="checkbox-outline" label="Tasks" hint={tasks.overdue > 0 ? `${tasks.overdue} overdue` : `${tasks.open} open`} warn={tasks.overdue > 0} onPress={() => router.push(`/project/${id}/tasks`)} />
          <ToolTile icon="document-text-outline" label="Daily reports" onPress={() => router.push(`/project/${id}/reports`)} />
          <ToolTile icon="images-outline" label="Gallery" onPress={() => router.push(`/project/${id}/photos`)} />
          <ToolTile icon="git-network-outline" label="Structure" hint="Blocks · floors · units" onPress={() => router.push({ pathname: '/project/[id]/structure', params: { id: String(id), name: project?.name } } as never)} />
          <ToolTile icon="stats-chart-outline" label="Progress" hint={`${Math.round(project?.progressPercentage ?? 0)}% complete`} onPress={() => router.push({ pathname: '/project/[id]/progress', params: { id: String(id), name: project?.name } } as never)} />
          <ToolTile
            icon="map-outline"
            label="Site map"
            hint={project?.latitude != null ? 'Pinned' : 'Not pinned'}
            warn={project?.latitude == null}
            onPress={() =>
              project?.latitude != null
                ? router.push(`/project/${id}/map`)
                : router.push(`/project/${id}/location`)
            }
          />
          <ToolTile
            icon="navigate-outline"
            label="Site location"
            hint={project?.latitude != null ? 'GPS check-in on' : 'Set pin'}
            onPress={() => router.push(`/project/${id}/location`)}
          />
        </View>

        {/* Workforce snapshot */}
        <SectionTitle text="Today's crew" />
        <Card style={{ marginHorizontal: spacing.lg }} padded>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <CrewStat label="Present" value={workforce.present} color={colors.success} />
            <CrewStat label="Half day" value={workforce.halfDay} color={colors.warning} />
            <CrewStat label="Absent" value={workforce.absent} color={colors.danger} />
            <CrewStat label="Leave" value={workforce.leave} color={colors.info} />
            <CrewStat label="Unmarked" value={workforce.unmarked} color={colors.textFaint} />
          </View>
          {workforce.unmarked > 0 ? (
            <Pressable
              onPress={() => router.push({ pathname: `/project/${id}/attendance`, params: { date: todayISO() } })}
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                Mark attendance for {workforce.unmarked} worker{workforce.unmarked === 1 ? '' : 's'} →
              </Text>
            </Pressable>
          ) : null}
        </Card>

        {/* Recent activity */}
        {data.recentActivity.length > 0 ? (
          <>
            <SectionTitle text="Recent activity" />
            <Card style={{ marginHorizontal: spacing.lg }} padded>
              <View style={{ gap: 11 }}>
                {data.recentActivity.slice(0, 8).map((a) => (
                  <View key={`${a.kind}-${a.id}`} style={styles.activityRow}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        backgroundColor: colors.surfaceAlt,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={
                          a.kind === 'expense'
                            ? 'cash-outline'
                            : a.kind === 'attendance'
                              ? 'people-outline'
                              : a.kind === 'material'
                                ? 'cube-outline'
                                : a.kind === 'task'
                                  ? 'checkbox-outline'
                                  : 'document-text-outline'
                        }
                        size={15}
                        color={colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13.5, fontWeight: '600' }}>
                        {a.title}
                      </Text>
                      {a.subtitle ? (
                        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
                          {a.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.textFaint, fontSize: 11 }}>
                      {relativeTime(a.timestamp)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  const { colors, spacing } = useTheme();
  return (
    <Text
      style={{
        color: colors.text,
        fontSize: 15.5,
        fontWeight: '800',
        paddingHorizontal: spacing.lg,
        marginTop: 24,
        marginBottom: 10,
        letterSpacing: -0.2,
      }}
    >
      {text}
    </Text>
  );
}

function ToolTile({
  icon,
  label,
  hint,
  warn,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  warn?: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 13,
        opacity: pressed ? 0.75 : 1,
        flexBasis: '47%',
        flexGrow: 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Ionicons name={icon} size={20} color={warn ? colors.warning : colors.primary} />
        {warn ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger }} /> : null}
      </View>
      <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '700', marginTop: 9 }}>{label}</Text>
      {hint ? (
        <Text numberOfLines={1} style={{ color: warn ? colors.warning : colors.textFaint, fontSize: 11.5, marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

function CrewStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 17, fontWeight: '800' }}>{value}</Text>
      <CrewLabel label={label} />
    </View>
  );
}

function CrewLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textFaint, fontSize: 10.5 }}>{label}</Text>;
}

const styles = StyleSheet.create({
  finCard: {
    backgroundColor: '#17263B',
    borderRadius: 14,
    padding: 16,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
