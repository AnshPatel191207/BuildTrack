import React, { useState, useEffect } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View, Pressable, Modal } from 'react-native';
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

  // Fetch available flats & commercial shops for selected project
  const { data: availableFlats } = useResource<PropertyUnit[]>(
    () => (selectedProjectId ? propertyService.listFlats(selectedProjectId, { status: 'available' }) : Promise.resolve([])),
    [selectedProjectId],
  );

  const { data: availableShops } = useResource<PropertyUnit[]>(
    () => (selectedProjectId ? propertyService.listShops(selectedProjectId, { status: 'available' }) : Promise.resolve([])),
    [selectedProjectId],
  );

  const availableUnits = React.useMemo(() => {
    const flats = (availableFlats || []).map((f) => ({ ...f, category: f.category || 'flat' }));
    const shops = (availableShops || []).map((s) => ({ ...s, category: s.category || 'shop' }));
    return [...flats, ...shops];
  }, [availableFlats, availableShops]);

  const [unitCategoryFilter, setUnitCategoryFilter] = useState<'all' | 'flat' | 'shop'>('all');
  const [unitSearch, setUnitSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const filteredUnits = React.useMemo(() => {
    return availableUnits.filter((u) => {
      if (unitCategoryFilter !== 'all' && u.category !== unitCategoryFilter) return false;
      if (unitSearch.trim()) {
        const q = unitSearch.toLowerCase();
        const num = (u.unitNumber || '').toLowerCase();
        const type = (u.unitType || '').toLowerCase();
        return num.includes(q) || type.includes(q);
      }
      return true;
    });
  }, [availableUnits, unitCategoryFilter, unitSearch]);

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch.trim()) return customers || [];
    const q = customerSearch.toLowerCase();
    return (customers || []).filter((c) => {
      return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
    });
  }, [customers, customerSearch]);

  // Selected unit details
  const selectedUnit = availableUnits.find((u) => u._id === unitId);
  const selectedCustomer = customers?.find((c) => c._id === customerId);

  // Computed summary
  const numericTotal = Number(totalAmount) || 0;
  const numericDiscount = Number(discountAmount) || 0;
  const numericToken = Number(tokenAmount) || 0;
  const netPayable = Math.max(0, numericTotal - numericDiscount);
  const balanceAfterToken = Math.max(0, netPayable - numericToken);

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
    if (numericDiscount > numericTotal) {
      showToast('Discount cannot exceed the total price', 'error');
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
      setUnitSearch('');
      setCustomerSearch('');
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
      case 'pending':
        return <Badge tone="warning" label="Pending Approval" />;
      case 'sold':
        return <Badge tone="info" label="Sold" />;
      case 'registered':
        return <Badge tone="info" label="Registered" />;
      case 'cancelled':
        return <Badge tone="danger" label="Cancelled" />;
      default:
        return <Badge tone="neutral" label={status} />;
    }
  };

  const handleDeleteBooking = (e: any, booking: PropertyBooking) => {
    e?.stopPropagation?.();
    const unitNo = (booking.unitId as any)?.unitNumber || 'Unit';
    const custName = (booking.customerId as any)?.name || 'Customer';
    Alert.alert(
      'Delete Booking',
      `Are you sure you want to delete Booking #${booking.bookingNumber || ''} for ${unitNo} (${custName})?\n\nThis will immediately release ${unitNo} back to available inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteBooking(booking._id);
              showToast(`Booking #${booking.bookingNumber || ''} deleted and ${unitNo} released to available`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete booking', 'error');
            }
          },
        },
      ],
    );
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

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: 10 }}>
        {/* Project Selector Horizontal Scroll */}
        {projects && projects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            <Pressable
              onPress={() => setSelectedProjectId('')}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: !selectedProjectId ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: !selectedProjectId ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: !selectedProjectId ? '#fff' : colors.text }}>
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
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.text }}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Status Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {['all', 'pending', 'confirmed', 'sold', 'cancelled'].map((st) => {
            const active = statusFilter === st;
            return (
              <Pressable
                key={st}
                onPress={() => setStatusFilter(st)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: radius.sm,
                  backgroundColor: active ? colors.primaryMuted : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.primary : colors.textFaint,
                    textTransform: 'capitalize',
                  }}
                >
                  {st === 'all' ? 'All Bookings' : st}
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
            <Skeleton height={130} />
            <Skeleton height={130} />
            <Skeleton height={130} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load bookings'} onRetry={reload} />
        ) : !bookings || bookings.length === 0 ? (
          <EmptyState
            title="No Bookings Yet"
            message="No units have been reserved or booked under this project."
            actionLabel="Create Booking"
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable
                      onPress={(e) => handleDeleteBooking(e, booking)}
                      hitSlop={10}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: radius.sm,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 1,
                        borderColor: colors.danger,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>Delete</Text>
                    </Pressable>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Actions</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 2 }}>
                        Manage →
                      </Text>
                    </View>
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
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>New Property Booking</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Allot Flat or Commercial Shop</Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14 }}>
              {/* Customer Selector */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Select Customer *</Text>
                  {selectedCustomer ? (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                      ✓ {selectedCustomer.name}
                    </Text>
                  ) : null}
                </View>

                <Input
                  placeholder="Filter customers by name or phone..."
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  style={{ marginBottom: 6 }}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {filteredCustomers.map((c) => {
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
                  {filteredCustomers.length === 0 ? (
                    <Text style={{ fontSize: 12, color: colors.textFaint, paddingVertical: 6 }}>No matching customers</Text>
                  ) : null}
                </ScrollView>
              </View>

              {/* Unit Category & Unit Selector */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Select Available Unit *</Text>
                  {selectedUnit ? (
                    <Badge
                      tone={selectedUnit.category === 'shop' ? 'orange' : 'success'}
                      label={`${selectedUnit.unitNumber} (${selectedUnit.category === 'shop' ? 'Shop' : 'Flat'})`}
                    />
                  ) : null}
                </View>

                {/* Category Pills */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {(['all', 'flat', 'shop'] as const).map((cat) => {
                    const active = unitCategoryFilter === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setUnitCategoryFilter(cat)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: radius.full,
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#fff' : colors.text }}>
                          {cat === 'all' ? `All Units (${availableUnits.length})` : cat === 'flat' ? `Flats (${availableFlats?.length || 0})` : `Shops (${availableShops?.length || 0})`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Input
                  placeholder="Search unit number (e.g. A-101, SHOP-01)..."
                  value={unitSearch}
                  onChangeText={setUnitSearch}
                  style={{ marginBottom: 6 }}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {filteredUnits.map((u) => {
                    const active = u._id === unitId;
                    const isShop = u.category === 'shop';
                    return (
                      <Pressable
                        key={u._id}
                        onPress={() => {
                          setUnitId(u._id);
                          const price = u.totalValue || u.basePrice || 0;
                          if (price > 0) {
                            setTotalAmount(String(price));
                          }
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: radius.md,
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          minWidth: 120,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: active ? '#fff' : colors.text }}>
                            {u.unitNumber}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: active ? '#fff' : colors.textFaint, textTransform: 'uppercase' }}>
                            {isShop ? 'Shop' : u.bedrooms ? `${u.bedrooms}BHK` : 'Flat'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: active ? '#fff' : colors.textMuted, marginTop: 4 }}>
                          {formatCurrency(u.totalValue || u.basePrice)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {filteredUnits.length === 0 ? (
                    <Text style={{ fontSize: 12, color: colors.textFaint, paddingVertical: 8 }}>
                      No available units found. Check filter or import inventory.
                    </Text>
                  ) : null}
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
                label="Token / Booking Deposit Paid Now (₹)"
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

              {/* Live Deal Summary Box */}
              {numericTotal > 0 ? (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, marginBottom: 2 }}>
                    Deal Financial Summary
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Agreed Base Amount:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{formatCurrency(numericTotal)}</Text>
                  </View>
                  {numericDiscount > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: colors.danger }}>Discount Applied:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.danger }}>- {formatCurrency(numericDiscount)}</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>Net Payable Price:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>{formatCurrency(netPayable)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.success }}>Token Amount Paid:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>{formatCurrency(numericToken)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Remaining Balance Due:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>{formatCurrency(balanceAfterToken)}</Text>
                  </View>
                </View>
              ) : null}

              <Button
                label={submitting ? 'Creating Booking...' : 'Confirm Booking'}
                onPress={handleCreateBooking}
                disabled={submitting}
                style={{ marginTop: 4, marginBottom: 16 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
