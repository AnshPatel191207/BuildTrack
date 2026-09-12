import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useDebouncedValue } from '@/hooks/useDebounce';

export interface Chip {
  label: string;
  value: string;
}

interface ListScreenProps<T> {
  title: string;
  subtitle?: string;
  fetchPage: (page: number) => Promise<{ items: T[]; pagination: any }>;
  deps: unknown[];
  renderItem: (item: T) => React.ReactElement | null;
  keyExtractor: (item: T) => string;
  addRoute?: string;
  addLabel?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  chips?: Chip[];
  chipValue?: string;
  onChipChange?: (value: string) => void;
  headerComponent?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  extraHeaderRight?: React.ReactNode;
  enabled?: boolean;
  summary?: { label: string; value: string; tone?: string }[];
}

/**
 * Shared scaffolding for ERP list screens: header + offline banner + search +
 * filter chips + paginated infinite list with pull-to-refresh and a FAB.
 */
export function ErpListScreen<T>({
  title,
  subtitle,
  fetchPage,
  deps,
  renderItem,
  keyExtractor,
  addRoute,
  addLabel = 'Add',
  searchPlaceholder,
  searchValue: controlledSearch,
  onSearchChange,
  chips,
  chipValue,
  onChipChange,
  headerComponent,
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'Items you create will appear here.',
  extraHeaderRight,
  enabled = true,
}: ListScreenProps<T>) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = theme;

  const [internalSearch, setInternalSearch] = useState('');
  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(
    () => JSON.stringify({ debouncedSearch, chipValue, deps }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, chipValue, JSON.stringify(deps)],
  );

  useEffect(() => {
    setPage(1);
    setItems([]);
    setPagination(null);
  }, [queryKey]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(items.length === 0);
    setError(null);
    (async () => {
      try {
        const result = await fetchPage(page);
        if (cancelled) return;
        setPagination(result.pagination ?? null);
        setItems((prev) => {
          if (page === 1) return result.items;
          const seen = new Set(prev.map((i: any) => i._id));
          return [...prev, ...result.items.filter((i: any) => !seen.has(i._id))];
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, page, enabled]);

  const loadMore = () => {
    if (
      pagination &&
      pagination.page < pagination.totalPages &&
      !loading &&
      !loadingMore
    ) {
      setPage((p) => p + 1);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setPage(1);
    try {
      const result = await fetchPage(1);
      setPagination(result.pagination ?? null);
      setItems(result.items);
      setError(null);
    } catch {
      // keep old data on refresh failure
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        large
        onBack={router.canGoBack() ? () => router.back() : undefined}
        right={
          <>
            {extraHeaderRight}
            {addRoute ? (
              <Pressable
                onPress={() => router.push(addRoute as never)}
                accessibilityRole="button"
                accessibilityLabel={addLabel}
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
                <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13.5 }}>
                  {addLabel}
                </Text>
              </Pressable>
            ) : null}
          </>
        }
      />
      <OfflineBanner />

      {searchPlaceholder !== undefined ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder} />
        </View>
      ) : null}

      {chips && chips.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 8, paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 2 }}>
            {chips.map((chipItem) => {
              const active = chipValue === chipItem.value;
              return (
                <Pressable
                  key={chipItem.value}
                  onPress={() => onChipChange?.(chipItem.value)}
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
                    {chipItem.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          keyExtractor(item) || String(index)
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListHeaderComponent={
          <>
            {headerComponent ?? null}
            {loading && items.length === 0 ? (
              <View style={{ paddingTop: 12, gap: 10 }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height={72} style={{ borderRadius: radius.md }} />
                ))}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading && items.length === 0 ? (
            error && items.length === 0 ? (
              <ErrorState message={error} offline onRetry={refresh} />
            ) : (
              <EmptyState icon="layers-outline" title={emptyTitle} message={emptyMessage} />
            )
          ) : null
        }
        renderItem={({ item }) => renderItem(item)}
        ListFooterComponent={
          pagination && pagination.page < pagination.totalPages && loadingMore ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: colors.textFaint, fontSize: 13 }}>Loading more…</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

/** Standard card row used across ERP lists. */
export function RowCard({
  onPress,
  onLongPress,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  right,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
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
          backgroundColor: iconBg ?? colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={17} color={iconColor ?? colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '600' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

