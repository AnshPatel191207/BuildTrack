import React, { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Alert, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { poService } from '@/services/erpService';
import { PO_STATUS_OPTIONS } from '@/constants/options';
import { PO_STATUS_TONES } from '@/constants/status';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { formatCompactINR, formatDateShort } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDataVersion, useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { PurchaseOrder } from '@/types';

export default function PurchaseOrdersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 350);
  const version = useDataVersionKey(DATA_KEYS.purchaseOrders);

  const fetchPage = useCallback(
    async (page: number) =>
      poService.list({
        status: (status || undefined) as never,
        search: debounced || undefined,
        page,
      }),
    [status, debounced, version],
  );

  const quickDeliver = (po: PurchaseOrder) => {
    Alert.alert('Record delivery?', `${po.poNumber} — stock will be posted into materials and the invoice added to project spend.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delivered',
        onPress: async () => {
          try {
            await poService.transition(po._id, 'deliver');
            showToast(`${po.poNumber} delivered — materials updated`);
            bump(DATA_KEYS.purchaseOrders);
            bump(DATA_KEYS.materials);
            bump(DATA_KEYS.expenses);
            bump(DATA_KEYS.dashboard);
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not update', 'error');
          }
        },
      },
    ]);
  };

  return (
    <ErpListScreen<PurchaseOrder>
      title="Purchase Orders"
      subtitle="Requirement → Approval → Delivery"
      fetchPage={fetchPage}
      deps={[status, debounced, version]}
      keyExtractor={(p) => p._id}
      addRoute="/modal/purchase-order"
      addLabel="New"
      searchPlaceholder="Search PO / invoice no…"
      searchValue={search}
      onSearchChange={setSearch}
      chips={[
        { label: 'All', value: '' },
        ...PO_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      ]}
      chipValue={status}
      onChipChange={setStatus}
      renderItem={(po) => {
        const vendorName = typeof po.vendorId === 'object' ? po.vendorId?.name : undefined;
        const outstanding = Math.max(po.totalAmount - po.paidAmount, 0);
        return (
          <RowCard
            icon="cart-outline"
            title={`${po.poNumber} · ${vendorName ?? 'Vendor'}`}
            subtitle={[
              `${po.items.length} item(s)`,
              `Ordered ${formatDateShort(po.orderedAt ?? po.createdAt)}`,
              po.invoiceNumber ? `Inv ${po.invoiceNumber}` : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={po.status} tone={PO_STATUS_TONES[po.status]} />
                <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: '700' }}>
                  {formatCompactINR(po.totalAmount)}
                  {outstanding > 0 ? ` · due ${formatCompactINR(outstanding)}` : ''}
                </Text>
              </View>
            }
            onPress={() => router.push(`/business/purchase-order/${po._id}` as never)}
            onLongPress={
              po.status === 'ordered'
                ? () => quickDeliver(po)
                : undefined
            }
          />
        );
      }}
      emptyTitle="No purchase orders"
      emptyMessage="Raise a PO when materials run low — approvals route to the owner."
    />
  );
}

