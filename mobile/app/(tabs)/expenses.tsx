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
import { Badge } from '@/components/ui/Badge';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS, useDataVersion } from '@/stores/dataVersion';
import { expenseService } from '@/services/projectDataService';
import { projectService } from '@/services/projectService';
import type { Expense, ExpenseCategory } from '@/types';
import { formatCompactINR, formatINR, formatDate } from '@/lib/format';

const CATEGORY_FILTERS: { label: string; value: ExpenseCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Materials', value: 'materials' },
  { label: 'Labor', value: 'labor' },
  { label: 'Transport', value: 'transportation' },
  { label: 'Equipment', value: 'equipment' },
];

function monthLabel(year: number, month0: number) {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[month0]} ${year}`;
}

export default function ExpensesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const expVersion = useDataVersionKey(DATA_KEYS.expenses);
  const projVersion = useDataVersionKey(DATA_KEYS.projects);
  const bumpDashboard = useDataVersion((s) => s.bump);
  const { colors, spacing, radius } = theme;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [projectId, setProjectId] = useState<string>('');
  const [page, setPage] = useState(1);

  const monthParam = `${year}-${String(month0 + 1).padStart(2, '0')}`;

  const projectsRes = useResource(() => projectService.listProjects({}), [projVersion]);
  const projectOptions = useMemo(
    () => (projectsRes.data?.items ?? []).map((p) => ({ label: p.name, value: p._id })),
    [projectsRes.data],
  );

  const fetchPage = useCallback(async () => {
    // Backend list endpoint filters by date range; derive it from the viewed month.
    const [yy, mm] = monthParam.split('-').map(Number);
    const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return expenseService.listExpenses({
      projectId: projectId || null,
      category: category === 'all' ? '' : category,
      from: `${monthParam}-01`,
      to: `${monthParam}-${String(lastDay).padStart(2, '0')}`,
      page,
      limit: 20,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, category, monthParam, page, expVersion]);

  const analyticsFetcher = useCallback(async () => {
    return expenseService.getExpenseAnalytics({ projectId: projectId || null, month: monthParam });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, monthParam, expVersion]);

  const listRes = useResource(fetchPage, [fetchPage]);
  const statsRes = useResource(analyticsFetcher, [analyticsFetcher]);

  React.useEffect(() => {
    setPage(1);
  }, [projectId, category, monthParam]);

  const expenses = listRes.data?.items ?? [];
  const pagination = listRes.data?.pagination;
  const maxCatTotal = Math.max(1, ...(statsRes.data?.byCategory ?? []).map((c) => c.total));

  const moveMonth = (delta: number) => {
    let m = month0 + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth0(m);
    setYear(y);
  };

  const onDelete = useCallback(
    async (expense: Expense) => {
      try {
        await expenseService.deleteExpense(expense._id);
        showToast('Expense deleted');
        bumpDashboard(DATA_KEYS.dashboard);
        listRes.reload();
        statsRes.reload();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not delete expense', 'error');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [listRes, statsRes],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Expenses"
        large
        right={
          <Pressable
            onPress={() => router.push('/modal/expense')}
            accessibilityRole="button"
            accessibilityLabel="Add expense"
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
        }
      />
      <OfflineBanner />

      {/* Month navigator */}
      <View style={[styles.monthNav, { paddingHorizontal: spacing.lg }]}>
        <Pressable onPress={() => moveMonth(-1)} hitSlop={10} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '700' }}>
          {monthLabel(year, month0)}
          {year === now.getFullYear() && month0 === now.getMonth() ? (
            <Text style={{ color: colors.textFaint, fontWeight: '600' }}> · so far</Text>
          ) : null}
        </Text>
        <Pressable onPress={() => moveMonth(1)} hitSlop={10} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Filters */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SelectField
          placeholder="All projects"
          options={[{ label: 'All projects', value: '' }, ...projectOptions]}
          value={projectId}
          onChange={(v) => setProjectId(v)}
        />
        <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
          {CATEGORY_FILTERS.map((f) => {
            const active = category === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setCategory(f.value)}
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
        </View>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(e) => e._id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 110 }}
        refreshControl={
          <RefreshControl refreshing={listRes.refreshing} onRefresh={() => void listRes.refresh()} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (pagination && pagination.page < pagination.totalPages && !listRes.loading) {
            setPage((p) => p + 1);
          }
        }}
        ListHeaderComponent={
          <>
            {/* Summary card */}
            {statsRes.loading && !statsRes.data ? (
              <Skeleton height={110} style={{ borderRadius: radius.lg, marginTop: 12 }} />
            ) : statsRes.data ? (
              <View style={[styles.summaryCard, { backgroundColor: colors.navy, marginTop: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, fontWeight: '600' }}>
                      Spent in {monthLabel(year, month0).split(' ')[0]}
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 }}>
                      {formatINR(statsRes.data.monthTotal)}
                    </Text>
                  </View>
                  <Badge label={`${statsRes.data.totalCount} entries`} tone="orange" />
                </View>
                {(statsRes.data.byCategory ?? []).length > 0 ? (
                  <View style={{ gap: 7, marginTop: 14 }}>
                    {[...statsRes.data.byCategory]
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 4)
                      .map((c) => (
                        <View key={c._id}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textTransform: 'capitalize' }}>
                              {c._id.replace('_', ' ')}
                            </Text>
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                              {formatCompactINR(c.total)}
                            </Text>
                          </View>
                          <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                            <View
                              style={{
                                width: `${Math.round((c.total / maxCatTotal) * 100)}%`,
                                height: '100%',
                                borderRadius: 3,
                                backgroundColor: colors.primary,
                              }}
                            />
                          </View>
                        </View>
                      ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          listRes.loading ? (
            <View style={{ paddingTop: 12, gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={72} style={{ borderRadius: radius.md }} />
              ))}
            </View>
          ) : listRes.error && !listRes.data ? (
            <ErrorState message={listRes.error} offline={listRes.offlineData} onRetry={() => void listRes.reload()} />
          ) : (
            <EmptyState
              icon="wallet-outline"
              title="No expenses found"
              message="Try a different month or filter."
              actionLabel="Add expense"
              onAction={() => router.push('/modal/expense')}
            />
          )
        }
        renderItem={({ item }) => (
          <ExpenseRow
            expense={item}
            onPress={() =>
              router.push({
                pathname: '/modal/expense',
                params: { id: item._id },
              })
            }
            onLongPress={() => void onDelete(item)}
          />
        )}
        ListFooterComponent={
          pagination && pagination.page < pagination.totalPages ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              {listRes.loading ? (
                <Text style={{ color: colors.textFaint, fontSize: 13 }}>Loading more…</Text>
              ) : null}
            </View>
          ) : null
        }
      />

      {/* Floating add button */}
      <Pressable
        onPress={() => router.push('/modal/expense')}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 96,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: pressed ? colors.primary : colors.primary,
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

function ExpenseRow({
  expense,
  onPress,
  onLongPress,
}: {
  expense: Expense;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Expense ${expense.title}, ${formatINR(expense.amount)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 13,
        marginTop: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="cash-outline" size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 11 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '600', flexShrink: 1 }}>
            {expense.title}
          </Text>
          {expense.receiptImage?.url ? (
            <Ionicons name="receipt-outline" size={13} color={colors.primary} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
          {[
            expense.category.replace('_', ' '),
            typeof expense.projectId === 'object' ? expense.projectId.name : null,
            formatDate(expense.date),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '800', marginLeft: 8 }}>
        {formatINR(expense.amount)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 16,
  },
});
