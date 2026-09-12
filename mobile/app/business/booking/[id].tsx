import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { bookingService, paymentService } from '@/services/erpService';
import { BOOKING_STATUS_TONES, PAYMENT_STATUS_TONES } from '@/constants/status';
import { formatINR, formatDateShort, todayISO } from '@/lib/format';
import type { Booking, Payment } from '@/types';

interface DetailData {
  booking: Booking;
  payments: Payment[];
  summary: {
    totalValue: number;
    paidAmount: number;
    outstanding: number;
    overdueAmount: number;
  };
}

export default function BookingDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { colors, spacing } = theme;

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await bookingService.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load booking.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refreshAll = async () => {
    bump(DATA_KEYS.bookings);
    bump(DATA_KEYS.payments);
    bump(DATA_KEYS.units);
    bump(DATA_KEYS.customers);
    bump(DATA_KEYS.dashboard);
    await load();
  };

  const runAction = (action: string) => {
    setBusy(true);
    (async () => {
      try {
        await bookingService.action(id, action);
        showToast(`Booking ${action.replace(/_/g, ' ')}`);
        await refreshAll();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Action failed', 'error');
      } finally {
        setBusy(false);
      }
    })();
  };

  const confirmCancel = () => {
    Alert.alert('Cancel this booking?', 'The unit will be released back to available.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => runAction('cancel'),
      },
    ]);
  };

  const markPaid = (payment: Payment) => {
    Alert.alert(
      'Record receipt',
      `Mark ${payment.paymentNumber} of ${formatINR(payment.amount)} as received?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Received',
          onPress: () =>
            (async () => {
              setBusy(true);
              try {
                await paymentService.markPaid(payment._id);
                showToast('Payment recorded');
                await refreshAll();
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Failed', 'error');
              } finally {
                setBusy(false);
              }
            })(),
        },
      ],
    );
  };

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Booking" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={80} style={{ borderRadius: 14 }} />
          ))}
        </View>
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Booking" onBack={() => router.back()} />
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }
  if (!data) return null;

  const { booking, payments, summary } = data;
  const unitNumber = typeof booking.unitId === 'object' ? booking.unitId?.unitNumber : '';
  const customerName =
    typeof booking.customerId === 'object' ? booking.customerId?.name : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={booking.bookingNumber}
        subtitle={`${unitNumber ?? ''} · ${customerName ?? ''}`}
        onBack={() => router.back()}
        right={<Badge label={booking.status} tone={BOOKING_STATUS_TONES[booking.status]} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
          <MetricCard
            label="Unit Value"
            value={formatINR(booking.totalValue)}
            icon="pricetag-outline"
            tone="navy"
            style={{ flex: 1 }}
          />
          <MetricCard
            label="Outstanding"
            value={formatINR(summary.outstanding)}
            sublabel={
              summary.overdueAmount > 0 ? `Overdue ${formatINR(summary.overdueAmount)}` : undefined
            }
            icon="alert-circle-outline"
            tone={summary.overdueAmount > 0 ? 'danger' : 'warning'}
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button
            label="Confirm"
            size="sm"
            variant="secondary"
            disabled={booking.status !== 'pending' || busy}
            onPress={() => runAction('confirm')}
            style={{ flex: 1 }}
          />
          <Button
            label="Mark Sold"
            size="sm"
            variant="secondary"
            disabled={booking.status !== 'confirmed' || busy}
            onPress={() => runAction('mark_sold')}
            style={{ flex: 1 }}
          />
          <Button
            label="Possession"
            size="sm"
            variant="secondary"
            disabled={booking.status !== 'sold' || busy}
            onPress={() => runAction('mark_possession')}
            style={{ flex: 1 }}
          />
          <Button
            label="Cancel"
            size="sm"
            variant="ghost"
            disabled={['cancelled', 'sold'].includes(booking.status) || busy}
            onPress={confirmCancel}
            style={{ flex: 1 }}
          />
        </View>

        <Button
          label="Generate / regenerate payment plan"
          variant="secondary"
          disabled={booking.status === 'cancelled' || busy}
          onPress={() => setScheduleSheetVisible(true)}
          style={{ marginTop: 10 }}
        />

        <Text
          style={{
            color: colors.textFaint,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginTop: spacing.lg,
          }}
        >
          Payment history &amp; schedule — tap pending to receive
        </Text>
        {payments.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No payments yet"
            message="Generate a payment plan to create the collection schedule."
          />
        ) : (
          payments.map((payment) => {
            const isPending = payment.status === 'pending';
            const overdue =
              isPending && payment.dueDate
                ? new Date(payment.dueDate).getTime() < Date.now()
                : false;
            return (
              <Pressable
                key={payment._id}
                disabled={!isPending || busy}
                onPress={() => markPaid(payment)}
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
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13.5 }}>
                    {payment.paymentNumber} · {payment.paymentType.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
                    {[
                      payment.dueDate ? `Due ${formatDateShort(payment.dueDate)}` : null,
                      payment.paidDate ? `Paid ${formatDateShort(payment.paidDate)}` : null,
                      payment.method.replace(/_/g, ' '),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                    {formatINR(payment.amount)}
                  </Text>
                  <Badge
                    label={
                      isPending ? (overdue ? 'Overdue · tap' : 'Pending · tap') : payment.status
                    }
                    tone={
                      isPending
                        ? overdue
                          ? 'danger'
                          : 'info'
                        : PAYMENT_STATUS_TONES[payment.status]
                    }
                  />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <SelectSheet
        visible={scheduleSheetVisible}
        onClose={() => setScheduleSheetVisible(false)}
        title="Payment plan installments"
        options={[3, 4, 6, 8, 12, 24].map((n) => ({
          label: `${n} monthly installments`,
          value: String(n),
        }))}
        value=""
        onSelect={(v) => {
          setScheduleSheetVisible(false);
          setBusy(true);
          (async () => {
            try {
              await bookingService.generateSchedule(id, Number(v), todayISO());
              showToast(`Plan created — ${v} installments`);
              await refreshAll();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Could not create plan', 'error');
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
void styles;

