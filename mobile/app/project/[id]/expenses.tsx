import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS, useDataVersion } from '@/stores/dataVersion';
import { expenseService } from '@/services/projectDataService';
import type { Expense } from '@/types';
import { formatCompactINR, formatDate, formatINR } from '@/lib/format';

export default function ProjectExpensesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const expVersion = useDataVersionKey(DATA_KEYS.expenses);
  const bumpDashboard = useDataVersion((s) => s.bump);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const fetcher = useCallback(
    () => expenseService.listExpenses({ projectId: id, limit: 100 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, expVersion],
  );
  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetcher, [fetcher]);

  const expenses = data?.items ?? [];
  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const confirmDelete = (e: Expense) => {
    Alert.alert('Delete expense?', `${e.title} — ${formatINR(e.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          expenseService
            .deleteExpense(e._id)
            .then(() => {
              showToast('Expense deleted');
              bumpDashboard(DATA_KEYS.dashboard);
              void reload();
            })
            .catch((err) =>
              showToast(err instanceof Error ? err.message : 'Could not delete expense', 'error'),
            );
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Expenses"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push({ pathname: '/modal/expense', params: { projectId: id } })}
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

      {/* Total strip */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={[styles.totalCard, {}]}>
          <TotalInner total={total} count={expenses.length} />
        </View>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(e) => e._id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 12, gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={70} style={{ borderRadius: radius.md }} />
              ))}
            </View>
          ) : error && !data ? (
            <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
          ) : (
            <EmptyState
              icon="wallet-outline"
              title="No expenses yet"
              message="Log cement bags, tea, transport — everything counts."
              actionLabel="Add expense"
              onAction={() => router.push({ pathname: '/modal/expense', params: { projectId: id } })}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/modal/expense', params: { id: item._id, projectId: id } })}
            onLongPress={() => confirmDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Expense ${item.title}, ${formatINR(item.amount)}`}
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
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '600' }}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                {[item.category.replace('_', ' '), item.paymentMethod.replace('_', ' '), formatDate(item.date)].join(' · ')}
              </Text>
            </View>
            <Badge label={item.paymentMethod.replace('_', ' ')} tone="neutral" />
            <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '800', marginLeft: 8 }}>
              {formatINR(item.amount)}
            </Text>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push({ pathname: '/modal/expense', params: { projectId: id } })}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 20,
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

function TotalInner({ total, count }: { total: number; count: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.navy, borderRadius: 14, padding: 16 }}>
      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, fontWeight: '600' }}>
        Total logged ({count} entries)
      </Text>
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: -0.4 }}>
        {formatINR(total)}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, marginTop: 4 }}>
        Long-press any entry to delete it · tap to edit
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  totalCard: {},
});
