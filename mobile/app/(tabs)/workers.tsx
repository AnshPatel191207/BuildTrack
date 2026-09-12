import React, { useCallback, useMemo, useState } from 'react';
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
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { SelectField } from '@/components/ui/SelectField';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { workerService } from '@/services/workerService';
import { projectService } from '@/services/projectService';
import type { Worker, WorkerType } from '@/types';
import { formatINR } from '@/lib/format';

const PAGE = 20;

const TYPE_FILTERS: { label: string; value: WorkerType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Masons', value: 'mason' },
  { label: 'Helpers', value: 'helper' },
  { label: 'Electricians', value: 'electrician' },
  { label: 'Carpenters', value: 'carpenter' },
];

export default function WorkersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = theme;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [typeFilter, setTypeFilter] = useState<WorkerType | 'all'>('all');
  const [projectId, setProjectId] = useState<string>('');

  const fetchPage = useCallback(
    (page: number) =>
      workerService.listWorkers({
        page,
        limit: PAGE,
        projectId: projectId || null,
        workerType: typeFilter === 'all' ? '' : typeFilter,
        search: debouncedSearch || undefined,
      }),
    [projectId, typeFilter, debouncedSearch],
  );

  const {
    items,
    pagination,
    loading,
    refreshing,
    error,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
    reload,
  } = usePagination<Worker>(fetchPage, [fetchPage]);

  // Local status filter (status isn't a server query param).
  const [showInactive, setShowInactive] = useState(true);
  const visible = useMemo(
    () => (showInactive ? items : items.filter((w) => w.status === 'active')),
    [items, showInactive],
  );

  const activeCount = items.filter((w) => w.status === 'active').length;
  const monthlyEstimate = items
    .filter((w) => w.status === 'active')
    .reduce((sum, w) => sum + (Number(w.dailyWage) || 0) * 26, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Workers"
        large
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push('/contacts/index')}
              accessibilityRole="button"
              accessibilityLabel="Import from contacts"
              hitSlop={6}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.full,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Ionicons name="people-outline" size={17} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/modal/worker')}
              accessibilityRole="button"
              accessibilityLabel="Add worker"
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
              <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13.5 }}>Add</Text>
            </Pressable>
          </View>
        }
      />
      <OfflineBanner />

      <View style={{ paddingHorizontal: spacing.lg }}>
        {/* Summary strip */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              {pagination?.total ?? items.length}
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>Total</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.success, fontSize: 18, fontWeight: '800' }}>{activeCount}</Text>
            <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>Active</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
              ₹{Math.round(monthlyEstimate / 1000)}k
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>Monthly est.</Text>
          </View>
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or phone"
        />

        {/* Project filter */}
        <View style={{ marginTop: 8 }}>
          <ProjectFilterSelect value={projectId} onChange={setProjectId} />
        </View>

        {/* Type chips */}
        <View style={{ flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setTypeFilter(f.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  backgroundColor: active ? colors.primary : colors.surfaceAlt,
                  borderRadius: radius.full,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ color: active ? colors.onPrimary : colors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setShowInactive((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: showInactive }}
            style={{
              backgroundColor: showInactive ? colors.primary : colors.surfaceAlt,
              borderRadius: radius.full,
              paddingHorizontal: 13,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: showInactive ? colors.onPrimary : colors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
              Inactive
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(w) => w._id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 14 }}>
              <Skeleton height={56} style={{ borderRadius: radius.md }} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 12, gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={68} style={{ borderRadius: radius.md }} />
              ))}
            </View>
          ) : error && items.length === 0 ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : (
            <EmptyState
              icon="people-outline"
              title="No workers found"
              message={
                debouncedSearch || typeFilter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Add your crew to start tracking attendance.'
              }
              actionLabel="Add worker"
              onAction={() => router.push('/modal/worker')}
            />
          )
        }
        renderItem={({ item }) => (
          <WorkerRow worker={item} onPress={() => router.push(`/workers/${item._id}`)} />
        )}
      />

      <Pressable
        onPress={() => router.push('/modal/worker')}
        accessibilityRole="button"
        accessibilityLabel="Add worker"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 96,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 8,
        })}
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

function ProjectFilterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useResource(() => projectService.listProjects({}), []);
  const options = useMemo(
    () => [
      { label: 'All projects', value: '' },
      ...(data?.items ?? []).map((p) => ({ label: p.name, value: p._id })),
    ],
    [data],
  );
  return (
    <SelectField
      placeholder="All projects"
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}

function WorkerRow({ worker, onPress }: { worker: Worker; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Worker ${worker.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 12,
        marginTop: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Avatar name={worker.name} size={42} tone={worker.status === 'active' ? 'navy' : 'muted'} />
      <View style={{ flex: 1, marginLeft: 11 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '700', flexShrink: 1 }}>
            {worker.name}
          </Text>
          {worker.status !== 'active' ? (
            <Badge label={worker.status === 'inactive' ? 'Inactive' : 'Left'} tone={worker.status === 'inactive' ? 'warning' : 'danger'} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 2, textTransform: 'capitalize' }}>
          {[worker.workerType.replace('_', ' '), worker.skill].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '700' }}>{formatINR(worker.dailyWage)}</Text>
        <Text style={{ color: colors.textFaint, fontSize: 11 }}>per day</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    paddingVertical: 10,
  },
});
