import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { MetricCard } from '@/components/ui/MetricCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { companyService } from '@/services/companyService';
import { notificationService } from '@/services/notificationService';
import type { GlobalDashboard } from '@/types';
import {
  formatDate,
  formatCompactINR,
  formatINR,
  relativeTime,
  todayISO,
} from '@/lib/format';

export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const unread = useUIStore((s) => s.unreadNotifications);
  const setUnread = useUIStore((s) => s.setUnread);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const dashVersion = useDataVersionKey(DATA_KEYS.dashboard);

  const { colors, spacing, radius } = theme;

  const fetchDashboard = useCallback(async () => {
    const data = await companyService.getGlobalDashboard();
    notificationService.getUnreadCount().then(setUnread).catch(() => {});
    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashVersion]);

  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource<GlobalDashboard>(fetchDashboard, [dashVersion]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const metrics = data?.metrics;
  const activity = data?.todaysActivity;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={`${greeting}, ${firstName}`}
        subtitle={user ? `Role: ${user.role[0].toUpperCase()}${user.role.slice(1)}${isOnline ? '' : '  •  Offline'}` : undefined}
        large
        right={
          <Link href="/notifications" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {unread > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: colors.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '800' }}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </Link>
        }
      />

      <OfflineBanner />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {/* KPI grid */}
        {loading ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Skeleton height={92} style={{ marginBottom: 10 }} />
            <Skeleton height={92} />
          </View>
        ) : error && !data ? (
          <View style={{ padding: spacing.lg }}>
            <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
          </View>
        ) : metrics ? (
          <>
            <View style={[styles.grid, { paddingHorizontal: spacing.lg }]}>
              <MetricCard
                label="Active projects"
                value={`${metrics.activeProjects}/${metrics.totalProjects}`}
                sublabel={`${metrics.completedProjects} completed`}
                icon="business-outline"
                tone="navy"
              />
              <MetricCard
                label="Spent this month"
                value={formatCompactINR(metrics.monthExpenses)}
                sublabel={`Today: ${formatCompactINR(metrics.todaysExpenses)}`}
                icon="wallet-outline"
                tone="primary"
              />
            </View>

            <Card style={{ marginHorizontal: spacing.lg, marginTop: 10 }} padded>
              <View style={styles.budgetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                    Total budget utilization
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2, letterSpacing: -0.4 }}>
                    {formatINR(metrics.totalSpent)}
                    <Text style={{ color: colors.textFaint, fontSize: 13, fontWeight: '600' }}>
                      {' '}of {formatINR(metrics.totalBudget)}
                    </Text>
                  </Text>
                </View>
                <Badge
                  label={
                    metrics.remainingBudget < 0
                      ? `Over by ${formatCompactINR(Math.abs(metrics.remainingBudget))}`
                      : `${formatCompactINR(metrics.remainingBudget)} left`
                  }
                  tone={metrics.remainingBudget < 0 ? 'danger' : 'success'}
                />
              </View>
              <ProgressBar
                fraction={metrics.budgetUtilization / 100}
                showLabel
                tone={
                  metrics.budgetUtilization >= 95
                    ? 'danger'
                    : metrics.budgetUtilization >= 80
                      ? 'warning'
                      : 'primary'
                }
              />
            </Card>

            {/* Today's activity strip */}
            <View style={[styles.grid, { paddingHorizontal: spacing.lg, marginTop: 10 }]}>
              <MetricCard
                label="Workers on site"
                value={`${metrics.workersPresentToday}`}
                sublabel={`of ${metrics.totalWorkers} total`}
                icon="people-outline"
                tone="success"
              />
              <MetricCard
                label="Needs attention"
                value={`${metrics.overdueTasks + metrics.lowStockCount}`}
                sublabel={`${metrics.overdueTasks} overdue · ${metrics.lowStockCount} low stock`}
                icon="alert-circle-outline"
                tone={(metrics.overdueTasks + metrics.lowStockCount) > 0 ? 'warning' : 'default'}
              />
            </View>

            {/* Projects */}
            <SectionHeader label="Your projects" actionLabel="See all" onPressAction={() => router.push('/(tabs)/projects')} />
            {data!.projects.length === 0 ? (
              <EmptyState
                icon="business-outline"
                title="No projects yet"
                message="Create your first site to start tracking work."
                actionLabel="Add project"
                onAction={() => router.push('/projects/new')}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled={false}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 10 }}
                style={{ flexGrow: 0 }}
              >
                {data!.projects.map((p) => (
                  <ProjectMiniCard key={p._id} project={p} onPress={() => router.push(`/project/${p._id}`)} />
                ))}
              </ScrollView>
            )}

            {/* Recent expenses */}
            <SectionHeader label="Recent expenses" actionLabel="See all" onPressAction={() => router.push('/(tabs)/expenses')} />
            <Card style={{ marginHorizontal: spacing.lg }} padded>
              {data!.recentExpenses.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13.5, textAlign: 'center', paddingVertical: 12 }}>
                  No expenses logged yet.
                </Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {data!.recentExpenses.slice(0, 5).map((e) => {
                    const projectName =
                      typeof e.projectId === 'object' ? e.projectId.name : undefined;
                    return (
                      <View key={e._id} style={styles.listRow}>
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: colors.primaryMuted,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="cash-outline" size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                            {e.title}
                          </Text>
                          <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
                            {[projectName, formatDate(e.date)].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                          {formatINR(e.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            {/* Activity feed */}
            {data!.recentActivity.length > 0 ? (
              <>
                <SectionHeader label="Today at a glance" />
                <Card style={{ marginHorizontal: spacing.lg }} padded>
                  <View style={{ gap: 10 }}>
                    {data!.todaysActivity.tasksDueToday > 0 || activity ? (
                      <>
                        <ActivityLine
                          icon="checkmark-circle-outline"
                          color={colors.success}
                          text={`${activity?.workersPresent ?? 0} present · ${activity?.workersAbsent ?? 0} absent today`}
                        />
                        <ActivityLine
                          icon="cube-outline"
                          color={colors.info}
                          text={`${activity?.materialDeliveries ?? 0} material ${activity?.materialDeliveries === 1 ? 'entry' : 'entries'} logged`}
                        />
                        <ActivityLine
                          icon="calendar-clear-outline"
                          color={colors.warning}
                          text={`${activity?.tasksDueToday ?? 0} tasks due today`}
                        />
                      </>
                    ) : null}
                    {data!.recentActivity.slice(0, 4).map((a) => (
                      <ActivityLine
                        key={`${a.kind}-${a.id}`}
                        icon={
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
                        color={colors.primary}
                        text={a.title}
                        time={relativeTime(a.timestamp)}
                      />
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            <Text style={{ textAlign: 'center', color: colors.textFaint, fontSize: 11.5, marginTop: spacing.xl }}>
              {formatDate(todayISO())} · BuildTrack
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label, actionLabel, onPressAction }: { label: string; actionLabel?: string; onPressAction?: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xl,
        marginBottom: 10,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16.5, fontWeight: '800', letterSpacing: -0.2, flex: 1 }}>
        {label}
      </Text>
      {actionLabel && onPressAction ? (
        <Pressable onPress={onPressAction} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ProjectMiniCard({
  project,
  onPress,
}: {
  project: GlobalDashboard['projects'][number];
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.name}`}
      style={({ pressed }) => [
        styles.projectCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.85 : 1,
          width: 250,
          padding: 14,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
          {project.name}
        </Text>
        {project.overBudget ? <Badge label="Over budget" tone="danger" /> : null}
      </View>
      <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
        {project.clientName ? `${project.clientName} · ` : ''}
        {project.location}
      </Text>
      <View style={{ marginTop: 10 }}>
        <ProgressBar
          fraction={project.progressPercentage / 100}
          tone={project.overBudget ? 'warning' : 'primary'}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
            {formatCompactINR(project.spentAmount)} / {formatCompactINR(project.budget)}
          </Text>
          <Text style={{ color: colors.text, fontSize: 11.5, fontWeight: '700' }}>
            {Math.round(project.progressPercentage)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ActivityLine({
  icon,
  color,
  text,
  time,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
  time?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={17} color={color} />
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13.5, flex: 1 }}>
        {text}
      </Text>
      {time ? (
        <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>{time}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
