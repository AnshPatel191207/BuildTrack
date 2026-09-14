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

  // Fetch bookings for payment picker (all active bookings)
  const { data: bookings, reload: reloadBookings } = useResource<PropertyBooking[]>(
    () => propertyService.listBookings(),
    [],
  );

  const availableBookings = bookings?.filter((b) => b.status !== 'cancelled') || [];
  const selectedBooking = availableBookings.find((b) => b._id === selectedBookingId);

  // Auto-fill customer if booking selected, or auto-select first booking
  useEffect(() => {
    if (selectedBookingId && availableBookings.length > 0) {
      const found = availableBookings.find((b) => b._id === selectedBookingId);
      if (found && (found.customerId as any)?._id) {
        setSelectedCustomerId((found.customerId as any)._id);
      }
    } else if (!selectedBookingId && availableBookings.length > 0) {
      setSelectedBookingId(availableBookings[0]._id);
      const custId = (availableBookings[0].customerId as any)?._id || (availableBookings[0] as any).customerId;
      if (custId) setSelectedCustomerId(custId);
    }
  }, [selectedBookingId, availableBookings]);

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
            onPress={() => {
              void reloadBookings();
              setModalOpen(true);
            }}
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
              {availableBookings.length === 0 ? (
                <View
                  style={{
                    padding: 14,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="information-circle-outline" size={24} color={colors.primary} style={{ marginBottom: 4 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>No Active Bookings Found</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 2, marginBottom: 10 }}>
                    Please create or confirm a booking first before recording installment payments.
                  </Text>
                  <Button
                    label="Go to Bookings"
                    size="sm"
                    onPress={() => {
                      setModalOpen(false);
                      router.push('/property/bookings' as any);
                    }}
                  />
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                    Select Booking ({availableBookings.length} Available) *
                  </Text>
                  <ScrollView
                    style={{ maxHeight: 150 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {availableBookings.map((b) => {
                      const active = b._id === selectedBookingId;
                      const unitNum = (b.unitId as any)?.unitNumber || 'Unit';
                      const custName = (b.customerId as any)?.name || 'Customer';
                      const totalVal = b.totalValue || (b as any).totalAmount || 0;
                      return (
                        <Pressable
                          key={b._id}
                          onPress={() => {
                            setSelectedBookingId(b._id);
                            const custId = (b.customerId as any)?._id || (b as any).customerId;
                            if (custId) setSelectedCustomerId(custId);
                          }}
                          style={{
                            padding: 10,
                            borderRadius: radius.md,
                            backgroundColor: active ? '#FDF5F0' : colors.surface,
                            borderWidth: 1.5,
                            borderColor: active ? colors.primary : colors.border,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: active ? colors.primary : colors.text }}>
                                Unit {unitNum}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.textMuted }}>• {b.bookingNumber}</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                              {custName} • ₹{Math.round(totalVal).toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Badge
                              tone={b.status === 'confirmed' ? 'success' : 'neutral'}
                              label={(b.status || 'pending').toUpperCase()}
                            />
                            {active && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {selectedBooking && (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.sm,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 10, color: colors.textFaint, textTransform: 'uppercase' }}>Selected Unit</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                      Unit {(selectedBooking.unitId as any)?.unitNumber || 'Unit'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, color: colors.textFaint, textTransform: 'uppercase' }}>Booking Total</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      ₹{Math.round(selectedBooking.totalValue || (selectedBooking as any).totalAmount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              )}

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
