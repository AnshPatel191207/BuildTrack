import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { projectService } from '@/services/projectService';
import type { Project, ProjectStatus } from '@/types';
import { formatCompactINR, formatDate, daysUntil } from '@/lib/format';

const PAGE = 20;

const FILTERS: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Planning', value: 'planning' },
  { label: 'On hold', value: 'on_hold' },
  { label: 'Completed', value: 'completed' },
];

export default function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = theme;
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const fetchPage = useCallback(
    (page: number) =>
      projectService.listProjects({
        page,
        limit: PAGE,
        status: filter === 'all' ? '' : filter,
        search: debouncedSearch || undefined,
      }),
    [filter, debouncedSearch],
  );

  const {
    items,
    loading,
    refreshing,
    error,
    loadingMore,
    loadMore,
    refresh,
    reload,
  } = usePagination<Project>(fetchPage, [fetchPage]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Projects"
        large
        right={
          <Pressable
            onPress={() => router.push('/projects/new')}
            accessibilityRole="button"
            accessibilityLabel="Add project"
            hitSlop={6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              paddingHorizontal: 13,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="add" size={17} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13.5 }}>New</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Search + filters */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={{ marginTop: spacing.md }}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, client or location"
          />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  backgroundColor: active ? colors.primary : colors.surfaceAlt,
                  borderRadius: radius.full,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.onPrimary : colors.textMuted,
                    fontSize: 12.5,
                    fontWeight: '700',
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p._id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 96, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListFooterComponent={
          loadingMore ? (
            <Skeleton height={120} style={{ borderRadius: radius.lg }} />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: spacing.lg, gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={120} style={{ borderRadius: radius.lg }} />
              ))}
            </View>
          ) : error && items.length === 0 ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : (
            <EmptyState
              icon="business-outline"
              title={search || filter !== 'all' ? 'No matching projects' : 'No projects yet'}
              message={
                search || filter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Create your first site to start tracking work.'
              }
              actionLabel={search || filter !== 'all' ? undefined : 'Add project'}
              onAction={() => router.push('/projects/new')}
            />
          )
        }
        renderItem={({ item }) => <ProjectCardItem project={item} onPress={() => router.push(`/project/${item._id}`)} />}
      />
    </View>
  );
}

function ProjectCardItem({ project, onPress }: { project: Project; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const days = daysUntil(project.expectedEndDate);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.name}`}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 14,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
          {project.name}
        </Text>
        <StatusBadge status={project.status} />
      </View>

      <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 3 }}>
        {[project.projectCode, project.clientName, project.location].filter(Boolean).join(' · ')}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ProgressBar fraction={project.progressPercentage / 100} tone={overBudget(project) ? 'warning' : 'primary'} />
        </View>
        <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '800', minWidth: 36, textAlign: 'right' }}>
          {Math.round(project.progressPercentage)}%
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {formatCompactINR(project.spentAmount)} spent · {formatCompactINR(Math.max(0, project.budget - project.spentAmount))} left
        </Text>
        <Text
          style={{
            color:
              overBudget(project)
                ? colors.danger
                : days != null && days < 0 && project.status === 'active'
                  ? colors.warning
                  : colors.textFaint,
            fontSize: 11.5,
            fontWeight: '600',
          }}
        >
          {overBudget(project)
            ? 'Over budget'
            : days == null
              ? formatDate(project.startDate)
              : days < 0
                ? `${Math.abs(days)}d overdue`
                : `${days}d left`}
        </Text>
      </View>
    </Pressable>
  );
}

function overBudget(p: Project): boolean {
  return p.spentAmount > p.budget && p.budget > 0;
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone =
    status === 'active' ? 'success' : status === 'completed' ? 'info' : status === 'cancelled' ? 'danger' : 'warning';
  const label = status === 'on_hold' ? 'On hold' : status[0].toUpperCase() + status.slice(1);
  return <Badge label={label} tone={tone as any} />;
}
