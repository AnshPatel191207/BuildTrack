import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { Skeleton } from '@/components/ui/Feedback';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { unitService } from '@/services/erpService';
import { UNIT_STATUS_OPTIONS } from '@/constants/options';
import { UNIT_STATUS_TONES } from '@/constants/status';
import { useTheme } from '@/hooks/useTheme';
import { formatCompactINR, formatINR } from '@/lib/format';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { InventorySummary, Unit, UnitStatus } from '@/types';

export default function InventoryScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const [status, setStatus] = useState<UnitStatus | ''>('');
  const version = useDataVersionKey(DATA_KEYS.units);
  const summaryRes = useResourceSummary(version);

  const fetchPage = useCallback(
    async (page: number) =>
      unitService.list({ status: status || undefined, page, limit: 20 }),
    [status, version],
  );

  return (
    <ErpListScreen<Unit>
      title="Unit Inventory"
      subtitle="Availability, pricing & sales value"
      fetchPage={fetchPage}
      deps={[status, version]}
      keyExtractor={(u) => u._id}
      addRoute="/modal/unit"
      addLabel="Add"
      chips={[
        { label: 'All', value: '' },
        ...UNIT_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      ]}
      chipValue={status}
      onChipChange={(v) => setStatus(v as UnitStatus | '')}
      headerComponent={
        summaryRes.loading && !summaryRes.data ? (
          <Skeleton height={96} style={{ borderRadius: 14, marginTop: 12 }} />
        ) : summaryRes.data ? (
          <View
            style={{
              backgroundColor: colors.navy,
              borderRadius: 14,
              padding: spacing.md,
              marginTop: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: '600' }}>
                Unsold inventory value
              </Text>
              <Badge label={`${summaryRes.data.totalUnits} units`} tone="orange" />
            </View>
            <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 2 }}>
              {formatCompactINR(summaryRes.data.unsoldInventoryValue)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <MiniStat label="Available" value={String(summaryRes.data.available)} />
              <MiniStat label="Booked" value={String(summaryRes.data.booked)} />
              <MiniStat label="Sold" value={String(summaryRes.data.sold)} />
              <MiniStat label="Collected" value={formatCompactINR(summaryRes.data.revenueCollected)} />
            </View>
          </View>
        ) : null
      }
      renderItem={(unit) => {
        const customerName =
          typeof unit.currentCustomerId === 'object' && unit.currentCustomerId
            ? unit.currentCustomerId.name
            : undefined;
        return (
          <RowCard
            icon="business-outline"
            title={`${unit.unitNumber} · ${unit.unitType}`}
            subtitle={[
              unit.areaSqft ? `${unit.areaSqft} sq.ft.` : undefined,
              unit.ratePerSqft ? `₹${formatINR(unit.ratePerSqft)}/sq.ft.` : undefined,
              customerName ?? undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={unit.status} tone={UNIT_STATUS_TONES[unit.status]} />
                <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: '700' }}>
                  {formatCompactINR(unit.totalValue)}
                </Text>
              </View>
            }
          />
        );
      }}
      emptyTitle="No units in this view"
      emptyMessage="Add units to track availability and sales."
    />
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 8 }}>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '600' }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function useResourceSummary(version: number) {
  const [data, setData] = React.useState<InventorySummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    unitService
      .summary(null)
      .then((s) => !cancelled && setData(s))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [version]);
  return { data, loading };
}
