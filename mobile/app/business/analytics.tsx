import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useResource } from '@/hooks/useResource';
import { useTheme } from '@/hooks/useTheme';
import { analyticsService } from '@/services/erpService';
import { formatCompactINR, formatDateShort } from '@/lib/format';

export default function AnalyticsScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;

  const execRes = useResource(() => analyticsService.executive(), []);
  const finRes = useResource(() => analyticsService.financial({}), []);

  const exec = execRes.data;
  const fin = finRes.data;
  const loading = (execRes.loading && !exec) || (finRes.loading && !fin);
  const error = finRes.error && !fin ? finRes.error : execRes.error && !exec ? execRes.error : null;

  const maxFlow = Math.max(1, ...(fin?.cashFlow ?? []).map((c) => Math.max(c.inflow, c.outflow)));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Analytics" subtitle="Executive cockpit" large />
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}>
        {loading ? (
          <>
            <Skeleton height={110} style={{ borderRadius: 14, marginTop: 12 }} />
            <Skeleton height={110} style={{ borderRadius: 14, marginTop: 10 }} />
          </>
        ) : error ? (
          <ErrorState message={error} offline onRetry={() => void execRes.reload()} />
        ) : !exec && !fin ? (
          <EmptyState title="No data yet" message="Metrics appear as your team works." />
        ) : (
          <>
            {/* Revenue & profitability */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <MetricCard
                label="Revenue Collected"
                value={formatCompactINR(exec?.finance.revenueCollected ?? 0)}
                icon="trending-up-outline"
                tone="success"
                style={{ flex: 1 }}
              />
              <MetricCard
                label="Profitability"
                value={formatCompactINR(exec?.finance.profitability ?? 0)}
                sublabel={`Budget used ${fin?.budgetUtilization ?? 0}%`}
                icon="pie-chart-outline"
                tone={(exec?.finance.profitability ?? 0) >= 0 ? 'primary' : 'danger'}
                style={{ flex: 1 }}
              />
            </View>

            {/* Receivables / payables */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <MetricCard
                label="Receivables"
                value={formatCompactINR(exec?.receivables.pending ?? 0)}
                sublabel={`Overdue ${formatCompactINR(exec?.receivables.overdue ?? 0)}`}
                icon="hand-left-outline"
                tone="warning"
                style={{ flex: 1 }}
              />
              <MetricCard
                label="Payables"
                value={formatCompactINR((exec?.payables.purchaseOrders ?? 0) + (exec?.payables.contractors ?? 0))}
                sublabel={`PO ${formatCompactINR(exec?.payables.purchaseOrders ?? 0)} · Contractors ${formatCompactINR(exec?.payables.contractors ?? 0)}`}
                icon="card-outline"
                tone="navy"
                style={{ flex: 1 }}
              />
            </View>

            {/* Sales snapshot */}
            {exec ? (
              <View
                style={{
                  backgroundColor: colors.navy,
                  borderRadius: 14,
                  padding: spacing.md,
                  marginTop: 10,
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, fontWeight: '700' }}>
                  SALES SNAPSHOT
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <MiniStat label="Bookings this month" value={String(exec.sales.bookingsThisMonth)} />
                  <MiniStat label="Booked value" value={formatCompactINR(exec.sales.bookedValue)} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <MiniStat label="Available" value={String(exec.sales.units.available)} />
                  <MiniStat label="Sold" value={String(exec.sales.units.sold)} />
                  <MiniStat label="Unsold inv." value={formatCompactINR(exec.sales.units.unsoldInventoryValue)} />
                </View>
              </View>
            ) : null}

            {/* Cash flow bars */}
            {fin ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginTop: 10,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
                  CASH FLOW — LAST 6 MONTHS
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 110, marginTop: 14 }}>
                  {fin.cashFlow.map((month) => (
                    <View key={month.month} style={{ flex: 1, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 84 }}>
                        <View
                          style={{
                            width: 9,
                            height: `${Math.max(4, Math.round((month.inflow / maxFlow) * 100))}%`,
                            backgroundColor: colors.success,
                            borderRadius: 3,
                          }}
                        />
                        <View
                          style={{
                            width: 9,
                            height: `${Math.max(4, Math.round((month.outflow / maxFlow) * 100))}%`,
                            backgroundColor: colors.danger,
                            borderRadius: 3,
                          }}
                        />
                      </View>
                      <Text style={{ color: colors.textFaint, fontSize: 10.5, marginTop: 6 }}>
                        {month.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
                  <Dot color={colors.success} label="Collections" />
                  <Dot color={colors.danger} label="Expenses" />
                </View>
              </View>
            ) : null}

            {/* Expense breakdown */}
            {fin && fin.expenseBreakdown.length > 0 ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginTop: 10,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
                  EXPENSE BREAKDOWN
                </Text>
                {fin.expenseBreakdown.slice(0, 6).map((row) => {
                  const max = Math.max(...fin.expenseBreakdown.map((r) => r.total));
                  return (
                    <View key={row.category} style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: colors.text, fontSize: 13, textTransform: 'capitalize' }}>
                          {row.category.replace(/_/g, ' ')}
                        </Text>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                          {formatCompactINR(row.total)}
                        </Text>
                      </View>
                      <ProgressBar fraction={max > 0 ? row.total / max : 0} style={{ marginTop: 5 }} />
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Milestones & alerts */}
            {exec ? (
              <View style={{ gap: 8, marginTop: 10 }}>
                {[...exec.milestones.delayed, ...exec.milestones.upcoming].slice(0, 8).map((m) => (
                  <Row
                    key={m._id}
                    left={
                      <Badge
                        label={
                          exec.milestones.delayed.some((d) => d._id === m._id) ? 'Delayed' : 'Upcoming'
                        }
                        tone={
                          exec.milestones.delayed.some((d) => d._id === m._id) ? 'danger' : 'info'
                        }
                      />
                    }
                    title={`${m.name} · ${m.projectName ?? ''}`}
                    subtitle={`Due ${formatDateShort(m.dueDate)}`}
                  />
                ))}
                <Row
                  left={<Badge label={`${exec.alerts.lowStockCount}`} tone={exec.alerts.lowStockCount > 0 ? 'warning' : 'success'} />}
                  title="Low stock materials"
                  subtitle="Items at or below minimum level"
                />
                <Row
                  left={<Badge label={`${exec.alerts.pendingApprovals}`} tone={exec.alerts.pendingApprovals > 0 ? 'orange' : 'success'} />}
                  title="Pending approvals"
                  subtitle="Requests awaiting sign-off"
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 9 }}>
      <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '600' }}>
        {label}
      </Text>
      <Text numberOfLines={1} style={{ color: '#FFF', fontSize: 14.5, fontWeight: '800' }}>
        {value}
      </Text>
    </View>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: '#888', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function Row({
  left,
  title,
  subtitle,
}: {
  left: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        gap: 10,
      }}
    >
      {left}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 13.5 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textFaint, fontSize: 11.5, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}
