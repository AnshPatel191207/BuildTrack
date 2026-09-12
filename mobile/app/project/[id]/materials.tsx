import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import {
  createTransaction,
  deleteMaterial,
  listMaterials,
} from '@/services/materialService';
import type { Material } from '@/types';import { formatCompactINR, formatINR, todayISO } from '@/lib/format';

const TRANSACTION_TYPES = [
  { label: 'Purchase — stock in', value: 'purchase' },
  { label: 'Usage — stock out', value: 'usage' },
  { label: 'Return — stock back', value: 'return' },
  { label: 'Adjustment — correction', value: 'adjustment' },
];

export default function MaterialsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const materialsVersion = useDataVersionKey(DATA_KEYS.materials);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const fetcher = React.useCallback(
    () => listMaterials({ projectId: id }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, materialsVersion],
  );
  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetcher, [fetcher]);

  const filtered = useMemo(() => {
    let list = data?.materials ?? [];
    if (lowOnly) list = list.filter((m) => m.isLowStock || m.currentStock <= m.minimumStock);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.supplier ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => Number(b.isLowStock ?? false) - Number(a.isLowStock ?? false));
  }, [data, search, lowOnly]);

  const summary = data?.summary;

  // ── Transaction sheet state ──────────────────────────────────────
  const [txnMaterial, setTxnMaterial] = useState<Material | null>(null);
  const [txnType, setTxnType] = useState('purchase');
  const [txnQty, setTxnQty] = useState('');
  const [txnPrice, setTxnPrice] = useState('');
  const [txnSupplier, setTxnSupplier] = useState('');
  const [txnInvoice, setTxnInvoice] = useState('');
  const [txnNotes, setTxnNotes] = useState('');
  const [txnSaving, setTxnSaving] = useState(false);

  const openTransaction = (m: Material) => {
    setTxnMaterial(m);
    setTxnType(m.currentStock <= m.minimumStock ? 'purchase' : 'usage');
    setTxnQty('');
    setTxnPrice(m.averagePrice > 0 ? String(m.averagePrice) : '');
    setTxnSupplier(m.supplier ?? '');
    setTxnInvoice('');
    setTxnNotes('');
  };

  const saveTransaction = async () => {
    if (!txnMaterial) return;
    const qty = Number(txnQty);
    if (!qty || qty <= 0) {
      showToast('Enter a quantity greater than zero', 'error');
      return;
    }
    setTxnSaving(true);
    try {
      await createTransaction(txnMaterial._id, {
        type: txnType as 'purchase' | 'usage' | 'adjustment' | 'return',
        quantity: txnType === 'usage' ? -Math.abs(qty) : Math.abs(qty),
        unitPrice: txnType === 'purchase' && txnPrice ? Number(txnPrice) : undefined,
        supplier: txnSupplier.trim() || undefined,
        invoiceNumber: txnInvoice.trim() || undefined,
        notes: txnNotes.trim() || undefined,
        date: todayISO(),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`${txnMaterial.name} stock updated`);
      setTxnMaterial(null);
      void reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not record transaction', 'error');
    } finally {
      setTxnSaving(false);
    }
  };

  const quickAdd = () => router.push({ pathname: '/modal/material', params: { projectId: id } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Materials"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={quickAdd}
            accessibilityRole="button"
            accessibilityLabel="Add material"
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

      {/* Summary */}
      {summary ? (
        <View style={[styles.summaryRow, { paddingHorizontal: spacing.lg }]}>
          <SummaryTile label="Items" value={String(summary.count)} color={colors.text} />
          <SummaryTile
            label="Low stock"
            value={String(summary.lowStockCount)}
            color={summary.lowStockCount > 0 ? colors.warning : colors.success}
          />
          <SummaryTile label="Est. value" value={formatCompactINR(summary.estimatedValue)} color={colors.navy === '#17263B' ? colors.primary : colors.primary} />
        </View>
      ) : null}

      {/* Search + low filter */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            height: 42,
          }}
        >
          <Ionicons name="search" size={17} color={colors.textFaint} />
          <TextInput
            placeholder="Search materials or suppliers"
            placeholderTextColor={colors.textFaint}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            accessibilityLabel="Search materials"
            style={{ flex: 1, marginLeft: 8, fontSize: 14.5, color: colors.text }}
          />
          <Pressable onPress={() => setLowOnly((v) => !v)} hitSlop={6}>
            <Badge label="Low" tone={lowOnly ? 'warning' : 'neutral'} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m._id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 12, gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={84} style={{ borderRadius: radius.md }} />
              ))}
            </View>
          ) : error && !data ? (
            <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
          ) : (
            <EmptyState
              icon="cube-outline"
              title="No materials tracked"
              message="Add cement, steel and other supplies to monitor stock."
              actionLabel="Add material"
              onAction={quickAdd}
            />
          )
        }
        renderItem={({ item }) => (
          <MaterialRow material={item} onPress={() => openTransaction(item)} />
        )}
      />

      {/* FAB */}
      <Pressable
        onPress={quickAdd}
        accessibilityRole="button"
        accessibilityLabel="Add material"
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

      {/* Transaction sheet */}
      <BottomSheet
        visible={txnMaterial != null}
        onClose={() => setTxnMaterial(null)}
        title={txnMaterial ? txnMaterial.name : ''}
        scroll
      >
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
          <SelectField
            label="Transaction type"
            options={TRANSACTION_TYPES}
            value={txnType}
            onChange={(v) => {
              setTxnType(v);
              setTxnQty('');
            }}
            required
          />
          {txnMaterial ? (
            <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>
              Current stock:{' '}
              <Text style={{ fontWeight: '800', color: colors.text }}>
                {txnMaterial.currentStock} {txnMaterial.unit.replace('_', ' ')}
              </Text>{' '}
              · minimum {txnMaterial.minimumStock}
            </Text>
          ) : null}
          <Input
            label={`Quantity (${txnMaterial?.unit.replace('_', ' ') ?? 'units'})`}
            value={txnQty}
            onChangeText={setTxnQty}
            placeholder="e.g. 50"
            keyboardType="numeric"
            required
          />
          {txnType === 'purchase' ? (
            <Input
              label="Unit price (₹)"
              value={txnPrice}
              onChangeText={setTxnPrice}
              placeholder="Rate per unit"
              keyboardType="numeric"
              prefix="₹"
              hint="Updates the average price automatically"
            />
          ) : null}
          {txnType === 'purchase' || txnType === 'return' ? (
            <>
              <Input label="Supplier" value={txnSupplier} onChangeText={setTxnSupplier} placeholder="Optional" autoCapitalize="words" />
              <Input label="Invoice / challan no." value={txnInvoice} onChangeText={setTxnInvoice} placeholder="Optional" autoCapitalize="none" />
            </>
          ) : null}
          <Input label="Notes" value={txnNotes} onChangeText={setTxnNotes} placeholder="Optional remarks" multiline />
          <Button
            label={txnSaving ? 'Recording…' : 'Record transaction'}
            loading={txnSaving}
            onPress={() => void saveTransaction()}
          />
          {txnMaterial ? (
            <Button
              label="Remove this material"
              variant="ghost"
              onPress={() => {
                Alert.alert(
                  `Delete ${txnMaterial.name}?`,
                  'Its transaction history will also be removed.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        deleteMaterial(txnMaterial._id)
                          .then(() => {
                            showToast('Material deleted');
                            setTxnMaterial(null);
                            void reload();
                          })
                          .catch((err) =>
                            showToast(err instanceof Error ? err.message : 'Could not delete', 'error'),
                          );
                      },
                    },
                  ],
                );
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 10 }} pointerEvents="none">
      <SummaryTileInner label={label} value={value} color={color} />
    </View>
  );
}

function SummaryTileInner({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, alignItems: 'center', paddingVertical: 10, borderRadius: 10 }}>
      <Text style={{ color, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: 10.5 }}>{label}</Text>
    </View>
  );
}

function MaterialRow({ material, onPress }: { material: Material; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const low = material.isLowStock ?? material.currentStock <= material.minimumStock;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${material.name}, ${material.currentStock} ${material.unit}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: low ? colors.warningSoft : colors.border,
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
          backgroundColor: low ? colors.warningSoft : colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={low ? 'alert-circle-outline' : 'cube-outline'} size={18} color={low ? colors.warning : colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 11 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '700', flexShrink: 1 }}>
            {material.name}
          </Text>
          {low ? <Badge label="Low" tone="warning" /> : null}
        </View>
        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
          {[formatINR(material.averagePrice), material.supplier].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '800' }}>
          {material.currentStock}
        </Text>
        <Text style={{ color: colors.textFaint, fontSize: 11 }}>{material.unit.replace('_', ' ')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.textFaint} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
});
