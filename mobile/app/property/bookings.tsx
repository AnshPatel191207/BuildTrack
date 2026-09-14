import React, { useState, useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable, Modal } from 'react-native';
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
import type { PropertyBooking, PropertyProject, PropertyCustomer, PropertyUnit } from '@/types';

function formatCurrency(amount?: number) {
  if (amount === undefined || amount === null) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export default function PropertyBookingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; unitId?: string; customerId?: string }>();
  const { colors, spacing, radius } = theme;

  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.projectId || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(Boolean(params.unitId));
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [customerId, setCustomerId] = useState(params.customerId || '');
  const [unitId, setUnitId] = useState(params.unitId || '');
  const [totalAmount, setTotalAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  // Fetch projects
  const { data: projects } = useResource<PropertyProject[]>(
    () => propertyService.listProjects(),
    [],
  );

  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  // Fetch customers for booking
  const { data: customers } = useResource<PropertyCustomer[]>(
    () => propertyService.listCustomers(),
    [],
  );

  // Fetch available units for selected project
  const { data: availableFlats } = useResource<PropertyUnit[]>(
    () => (selectedProjectId ? propertyService.listFlats(selectedProjectId, { status: 'available' }) : Promise.resolve([])),
    [selectedProjectId],
  );

  // Fetch bookings
  const {
    data: bookings,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyBooking[]>(
    () =>
      propertyService.listBookings({
        projectId: selectedProjectId || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
    [selectedProjectId, statusFilter],
  );

  const handleCreateBooking = async () => {
    if (!selectedProjectId) {
      showToast('Select project first', 'error');
      return;
    }
    if (!customerId) {
      showToast('Select a customer', 'error');
      return;
    }
    if (!unitId) {
      showToast('Select a unit to book', 'error');
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      showToast('Enter valid agreed total amount', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await propertyService.createBooking({
        projectId: selectedProjectId,
        unitId,
        customerId,
        totalAmount: Number(totalAmount),
        tokenAmount: tokenAmount ? Number(tokenAmount) : 0,
        discountAmount: discountAmount ? Number(discountAmount) : 0,
        discountReason: discountReason.trim() || undefined,
      });
      showToast('Booking created successfully!', 'success');
      setModalOpen(false);
      setUnitId('');
      setCustomerId('');
      setTotalAmount('');
      setTokenAmount('');
      setDiscountAmount('');
      setDiscountReason('');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge tone="success" label="Confirmed" />;
      case 'draft':
        return <Badge tone="neutral" label="Draft" />;
      case 'registered':
        return <Badge tone="info" label="Registered" />;
      case 'cancelled':
        return <Badge tone="danger" label="Cancelled" />;
      default:
        return <Badge tone="neutral" label={status} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Property Bookings"
        subtitle="Sales contracts, unit allotment & payments"
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
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New Booking</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Project Selector Bar */}
      {projects && projects.length > 0 && (
        <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
            <Pressable
              onPress={() => setSelectedProjectId('')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: !selectedProjectId ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: !selectedProjectId ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: !selectedProjectId ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>
                All Projects
              </Text>
            </Pressable>
            {projects.map((p) => {
              const active = p._id === selectedProjectId;
              return (
                <Pressable
                  key={p._id}
                  onPress={() => setSelectedProjectId(p._id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: active ? '700' : '500' }}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Status Filter */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {['all', 'draft', 'confirmed', 'registered', 'cancelled'].map((st) => {
            const active = statusFilter === st;
            return (
              <Pressable
                key={st}
                onPress={() => setStatusFilter(st)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : colors.textMuted, textTransform: 'capitalize' }}>
                  {st}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load bookings'} onRetry={reload} />
        ) : !bookings || bookings.length === 0 ? (
          <EmptyState
            title="No Bookings Recorded"
            message="Create a property booking to allocate a flat or shop to a customer."
            actionLabel="New Booking"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {bookings.map((booking) => (
              <Card
                key={booking._id}
                style={{ padding: 16 }}
                onPress={() => router.push(`/property/booking/${booking._id}` as any)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                        Unit {(booking.unitId as any)?.unitNumber || 'Unit'}
                      </Text>
                      {getStatusBadge(booking.status)}
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                      👤 {(booking.customerId as any)?.name || 'Customer'} • {(booking.projectId as any)?.name || 'Project'}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>
                    {formatCurrency(booking.finalPrice || booking.totalValue || booking.bookingAmount)}
                  </Text>
                </View>

                {/* Progress & Balances */}
                <View
                  style={{
                    flexDirection: 'row',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Token Paid</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.success, marginTop: 2 }}>
                      {formatCurrency(booking.bookingAmount)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Booking Date</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                      {new Date(booking.bookingDate).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Actions</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 2 }}>
                      Manage →
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Booking Modal */}
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>New Property Booking</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              {/* Customer Selector */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Select Customer *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {customers?.map((c) => {
                    const active = c._id === customerId;
                    return (
                      <Pressable
                        key={c._id}
                        onPress={() => setCustomerId(c._id)}
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
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Unit Selector */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Select Available Unit *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {availableFlats?.map((u) => {
                    const active = u._id === unitId;
                    return (
                      <Pressable
                        key={u._id}
                        onPress={() => {
                          setUnitId(u._id);
                          if (u.basePrice) {
                            setTotalAmount(String(u.basePrice));
                          }
                        }}
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
                          {u.unitNumber} ({u.bedrooms ? `${u.bedrooms}BHK` : 'Unit'})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Input
                label="Agreed Total Amount (₹) *"
                placeholder="e.g. 5200000"
                keyboardType="numeric"
                value={totalAmount}
                onChangeText={setTotalAmount}
              />

              <Input
                label="Token / Booking Deposit Paid (₹)"
                placeholder="e.g. 100000"
                keyboardType="numeric"
                value={tokenAmount}
                onChangeText={setTokenAmount}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Discount (₹)"
                    placeholder="e.g. 50000"
                    keyboardType="numeric"
                    value={discountAmount}
                    onChangeText={setDiscountAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Discount Reason"
                    placeholder="Festival offer / spot"
                    value={discountReason}
                    onChangeText={setDiscountReason}
                  />
                </View>
              </View>

              <Button
                label={submitting ? 'Creating Booking...' : 'Confirm Booking'}
                onPress={handleCreateBooking}
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
