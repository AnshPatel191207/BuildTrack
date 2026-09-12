import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { RowCard } from '@/components/erp/ListScreenKit';
import { paymentService } from '@/services/erpService';
import { useResource } from '@/hooks/useResource';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { formatCompactINR, formatDateShort, daysUntil } from '@/lib/format';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';

export default function ReceivablesScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const dashboardRes = useResource(() => paymentService.receivables(null), []);

  const overdueListRes = useResource(
    () => paymentService.list({ status: 'pending', overdue: true, limit: 50 }),
    [],
  );

  const markPaid = useCallback(
    (payment: any) => {
      Alert.alert(
        'Record receipt',
        `Mark ${payment.paymentNumber} of ₹${Math.round(payment.amount).toLocaleString('en-IN')} as received?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Received',
            onPress: async () => {
              setMarkingId(payment._id);
              try {
                await paymentService.markPaid(payment._id);
                showToast('Payment recorded');
                bump(DATA_KEYS.payments);
                bump(DATA_KEYS.bookings);
                bump(DATA_KEYS.dashboard);
                dashboardRes.reload();
                overdueListRes.reload();
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Could not record', 'error');
              } finally {
                setMarkingId(null);
              }
            },
          },
        ],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboardRes.reload, overdueListRes.reload],
  );

  const data = dashboardRes.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Receivables" subtitle="Money to collect from customers" large />
      <OfflineBanner />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}>
        {dashboardRes.loading && !data ? (
          <Skeleton height={120} style={{ borderRadius: 14, marginTop: 12 }} />
        ) : dashboardRes.error && !data ? (
          <ErrorState message={dashboardRes.error} offline={dashboardRes.offlineData} onRetry={() => void dashboardRes.reload()} />
        ) : data ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <MetricCard
                label="Total Receivable"
                value={formatCompactINR(data.totalReceivable)}
                sublabel={`${data.pendingCount} pending entries`}
                icon="hand-left-outline"
                tone="navy"
                style={{ flex: 1 }}
              />
              <MetricCard
                label="Overdue"
                value={formatCompactINR(data.overdueAmount)}
                sublabel={`${data.overdueCount} overdue`}
                icon="warning-outline"
                tone="danger"
                style={{ flex: 1 }}
              />
            </View>

            <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
              Due in the next 7 days
            </Text>
            {data.upcoming.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13.5, marginTop: 6 }}>
                Nothing due this week.
              </Text>
            ) : (
              data.upcoming.map((p) => (
                <RowCard
                  key={p._id}
                  icon="calendar-outline"
                  iconBg={colors.infoSoft}
                  iconColor={colors.info}
                  title={`${(typeof p.customerId === 'object' ? p.customerId?.name : '') ?? 'Customer'} · ${formatCompactINR(p.amount)}`}
                  subtitle={`Due ${formatDateShort(p.dueDate)} · ${p.daysUntilDue <= 0 ? 'today' : `${p.daysUntilDue}d left`}`}
                  right={<Badge label={`${p.daysUntilDue}d`} tone="info" />}
                />
              ))
            )}

            <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
              Overdue payments — tap to record receipt
            </Text>
            {overdueListRes.loading && !overdueListRes.data ? (
              <Skeleton height={64} style={{ borderRadius: 12, marginTop: 10 }} />
            ) : (overdueListRes.data?.items.length ?? 0) === 0 ? (
              <EmptyState icon="checkmark-circle-outline" title="Nothing overdue" message="Every pending payment is still within its due date." />
            ) : (
              overdueListRes.data!.items.map((p) => {
                const customerName =
                  typeof p.customerId === 'object' ? p.customerId?.name : undefined;
                const late = Math.abs(daysUntil(p.dueDate) ?? 0);
                return (
                  <RowCard
                    key={p._id}
                    icon="alert-circle-outline"
                    iconBg={colors.dangerSoft}
                    iconColor={colors.danger}
                    title={`${customerName ?? 'Customer'} · ${formatCompactINR(p.amount)}`}
                    subtitle={[
                      p.paymentNumber,
                      `Was due ${formatDateShort(p.dueDate)} (${late}d late)`,
                      typeof p.projectId === 'object' ? p.projectId?.name : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={
                      <View
                        style={{
                          backgroundColor: markingId === p._id ? colors.surfaceAlt : colors.success,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                        }}
                      >
                        <Text style={{ color: markingId === p._id ? colors.textMuted : '#FFF', fontWeight: '700', fontSize: 12 }}>
                          {markingId === p._id ? '…' : 'Receive'}
                        </Text>
                      </View>
                    }
                    onPress={() => markPaid(p)}
                  />
                );
              })
            )}

            <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
              Customer-wise outstanding
            </Text>
            {data.customerWise.map((row) => (
              <RowCard
                key={row.customer?._id ?? Math.random()}
                icon="person-outline"
                title={row.customer?.name ?? 'Customer'}
                subtitle={[
                  row.overdue > 0 ? `Overdue ${formatCompactINR(row.overdue)}` : undefined,
                  `${row.count} pending`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                    {formatCompactINR(row.outstanding)}
                  </Text>
                }
              />
            ))}
          </>
        ) : null}
      </View>
    </View>
  );
}
