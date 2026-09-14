import React, { useState, useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable, Modal, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { PropertyPayment, PropertyBooking } from '@/types';

function formatCurrency(amount?: number) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export default function PropertyPaymentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string; customerId?: string }>();
  const { colors, spacing, radius } = theme;

  const [modalOpen, setModalOpen] = useState(Boolean(params.bookingId));
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedBookingId, setSelectedBookingId] = useState(params.bookingId || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId || '');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'cheque' | 'neft' | 'rtgs' | 'cash' | 'upi'>('neft');
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch bookings for payment picker
  const { data: bookings } = useResource<PropertyBooking[]>(
    () => propertyService.listBookings({ status: 'confirmed' }),
    [],
  );

  // Auto-fill customer if booking selected
  useEffect(() => {
    if (selectedBookingId && bookings) {
      const found = bookings.find((b) => b._id === selectedBookingId);
      if (found && (found.customerId as any)?._id) {
        setSelectedCustomerId((found.customerId as any)._id);
      }
    }
  }, [selectedBookingId, bookings]);

  // Fetch payments
  const {
    data: payments,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyPayment[]>(
    () =>
      propertyService.listPayments({
        bookingId: params.bookingId || undefined,
        customerId: params.customerId || undefined,
      }),
    [params.bookingId, params.customerId],
  );

  const totalCollected = payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;

  const handleRecordPayment = async () => {
    if (!selectedBookingId) {
      showToast('Please select a booking', 'error');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showToast('Enter a valid payment amount', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await propertyService.recordPayment({
        bookingId: selectedBookingId,
        customerId: selectedCustomerId || undefined,
        amount: Number(amount),
        mode,
        paymentDate: new Date().toISOString(),
        transactionId: mode !== 'cheque' ? reference : undefined,
        chequeNumber: mode === 'cheque' ? reference : undefined,
        bankName: bankName.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      showToast(`Receipt ${res.receiptNumber || ''} created!`, 'success');
      setModalOpen(false);
      setAmount('');
      setReference('');
      setBankName('');
      setNotes('');
      void reload();

      // Offer to download receipt PDF
      if (res?._id) {
        const url = propertyService.getReceiptPdfUrl(res._id);
        void Linking.openURL(url);
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Receivables & Payments"
        subtitle="Record installments, collections & auto-receipts"
        large
        right={
          <Pressable
            onPress={() => setModalOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.md,
            }}
          >
            <Ionicons name="add" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Record Pay</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Hero Stat */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase', fontWeight: '700' }}>
            Total Collections Recorded
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.success, marginTop: 2 }}>
            {formatCurrency(totalCollected)}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/property/receipts')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceAlt,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="receipt-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>All Receipts</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={100} />
            <Skeleton height={100} />
            <Skeleton height={100} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load payments'} onRetry={reload} />
        ) : !payments || payments.length === 0 ? (
          <EmptyState
            title="No Payments Recorded"
            message="Record installment payments received from real estate customers."
            actionLabel="Record Payment"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {payments.map((p) => (
              <Card key={p._id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                        {p.receiptNumber || 'Payment'}
                      </Text>
                      <Badge tone="orange" label={(p.mode || p.method || 'PAYMENT').toUpperCase()} />
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                      {new Date(p.paidDate || p.dueDate || new Date()).toLocaleDateString('en-IN')} • {(p.customerId as any)?.name || 'Customer'}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 17, fontWeight: '800', color: colors.success }}>
                    {formatCurrency(p.amount)}
                  </Text>
                </View>

                {p.transactionId || p.chequeNumber ? (
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
                    Ref / Cheque: {p.transactionId || p.chequeNumber} {p.bankName ? `(${p.bankName})` : ''}
                  </Text>
                ) : null}

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      const url = propertyService.getReceiptPdfUrl(p._id);
                      void Linking.openURL(url);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radius.sm,
                    }}
                  >
                    <Ionicons name="download-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Receipt PDF</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              maxHeight: '92%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Record Customer Payment</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              {/* Select Booking */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                  Select Confirmed Booking *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {bookings?.map((b) => {
                    const active = b._id === selectedBookingId;
                    return (
                      <Pressable
                        key={b._id}
                        onPress={() => setSelectedBookingId(b._id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: radius.md,
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : colors.text }}>
                          Unit {(b.unitId as any)?.unitNumber || 'Unit'} • {(b.customerId as any)?.name || 'Customer'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Input
                label="Amount Paid (₹) *"
                placeholder="e.g. 500000"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Payment Mode Pills */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                  Payment Mode *
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {(['neft', 'rtgs', 'cheque', 'upi', 'cash'] as const).map((m) => {
                    const active = mode === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setMode(m)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radius.sm,
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.text, textTransform: 'uppercase' }}>
                          {m}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Input
                label={mode === 'cheque' ? 'Cheque Number' : 'Transaction Ref / UTR'}
                placeholder={mode === 'cheque' ? 'e.g. 048291' : 'e.g. UTR192837465'}
                value={reference}
                onChangeText={setReference}
              />

              <Input
                label="Bank Name (Optional)"
                placeholder="e.g. HDFC Bank, SBI"
                value={bankName}
                onChangeText={setBankName}
              />

              <Input
                label="Payment Notes"
                placeholder="e.g. 2nd Slab installment payment"
                value={notes}
                onChangeText={setNotes}
              />

              <Button
                label={submitting ? 'Recording & Generating...' : 'Record Payment & Generate Receipt'}
                onPress={handleRecordPayment}
                disabled={submitting}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
