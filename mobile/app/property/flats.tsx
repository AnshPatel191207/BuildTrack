import React, { useState, useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable, Modal, Alert } from 'react-native';
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
import type { PropertyProject, PropertyTower, PropertyFloor, PropertyUnit } from '@/types';

function formatCurrency(amount?: number) {
  if (amount === undefined || amount === null) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export default function PropertyFlatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; towerId?: string; floorId?: string }>();
  const { colors, spacing, radius } = theme;

  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.projectId || '');
  const [selectedTowerId, setSelectedTowerId] = useState<string>(params.towerId || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bhkFilter, setBhkFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Flat Form State
  const [formFloorId, setFormFloorId] = useState(params.floorId || '');
  const [flatNumber, setFlatNumber] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [carpetArea, setCarpetArea] = useState('');
  const [builtUpArea, setBuiltUpArea] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [parkingSlot, setParkingSlot] = useState('');
  const [parkingCharges, setParkingCharges] = useState('');

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

  // Fetch towers
  const { data: towers } = useResource<PropertyTower[]>(
    () => (selectedProjectId ? propertyService.listTowers(selectedProjectId) : Promise.resolve([])),
    [selectedProjectId],
  );

  // Fetch floors
  const { data: floors } = useResource<PropertyFloor[]>(
    () =>
      selectedProjectId && selectedTowerId
        ? propertyService.listFloors(selectedProjectId, selectedTowerId)
        : Promise.resolve([]),
    [selectedProjectId, selectedTowerId],
  );

  useEffect(() => {
    if (floors && floors.length > 0 && !formFloorId) {
      setFormFloorId(floors[0]._id);
    }
  }, [floors, formFloorId]);

  // Fetch flats
  const {
    data: flats,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyUnit[]>(
    () =>
      selectedProjectId
        ? propertyService.listFlats(selectedProjectId, {
            towerId: selectedTowerId || undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
          })
        : Promise.resolve([]),
    [selectedProjectId, selectedTowerId, statusFilter],
  );

  // Filtered flats by search and BHK
  const filteredFlats = (flats || []).filter((flat) => {
    if (search.trim()) {
      const match = flat.unitNumber.toLowerCase().includes(search.toLowerCase());
      if (!match) return false;
    }
    if (bhkFilter !== 'all' && flat.bedrooms !== Number(bhkFilter)) {
      return false;
    }
    return true;
  });

  // Inventory stats
  const totalCount = flats?.length || 0;
  const availableCount = flats?.filter((f) => f.status === 'available').length || 0;
  const bookedCount = flats?.filter((f) => f.status === 'booked').length || 0;
  const soldCount = flats?.filter((f) => f.status === 'sold').length || 0;

  const handleCreate = async () => {
    if (!selectedProjectId) {
      showToast('Select project first', 'error');
      return;
    }
    if (!flatNumber.trim()) {
      showToast('Flat number is required (e.g. 101, 204)', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const numericBedrooms = bedrooms ? Number(bedrooms) : 2;
      const area = Number(carpetArea || builtUpArea || 850);
      const price = Number(basePrice || 0);
      const parking = Number(parkingCharges || 0);
      await propertyService.createFlat(selectedProjectId, {
        unitNumber: flatNumber.trim(),
        towerId: selectedTowerId || undefined,
        floorId: formFloorId || undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        unitType: `${numericBedrooms}BHK`,
        carpetAreaSqft: carpetArea ? Number(carpetArea) : area,
        builtUpAreaSqft: builtUpArea ? Number(builtUpArea) : area,
        areaSqft: area,
        basePrice: basePrice ? Number(basePrice) : undefined,
        totalValue: price + parking,
        parkingSlot: parkingSlot.trim() || undefined,
        parkingCharges: parkingCharges ? Number(parkingCharges) : undefined,
      });
      showToast('Flat created successfully', 'success');
      setModalOpen(false);
      setFlatNumber('');
      setCarpetArea('');
      setBuiltUpArea('');
      setBasePrice('');
      setParkingSlot('');
      setParkingCharges('');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create flat', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge tone="success" label="Available" />;
      case 'booked':
        return <Badge tone="warning" label="Booked" />;
      case 'sold':
        return <Badge tone="danger" label="Sold" />;
      case 'blocked':
        return <Badge tone="neutral" label="Blocked" />;
      default:
        return <Badge tone="neutral" label={status} />;
    }
  };

  const handleDeleteFlat = (flatId: string, unitNum: string, status: string) => {
    if (status === 'booked' || status === 'sold') {
      Alert.alert(
        'Cannot Delete Unit',
        `Flat ${unitNum} is currently marked as "${status}". Units with active bookings or sales cannot be deleted to preserve financial audit integrity.`,
      );
      return;
    }

    Alert.alert(
      'Delete Flat',
      `Are you sure you want to delete Flat ${unitNum}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteFlat(flatId);
              showToast(`Flat ${unitNum} deleted`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete flat', 'error');
            }
          },
        },
      ],
    );
  };

  const handleDeleteAllFlats = () => {
    if (!selectedProjectId) {
      showToast('Select project first', 'error');
      return;
    }

    Alert.alert(
      'Delete All Flats',
      'Are you sure you want to delete all available flats in this project? Booked/Sold units with customer records will be safely preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Available',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await propertyService.deleteAllUnits({
                projectId: selectedProjectId,
                category: 'flat',
              });
              showToast(res.message || `Deleted ${res.deletedCount} flats`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete flats', 'error');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Flats & Apartments"
        subtitle="Residential inventory, carpet area & pricing"
        large
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {totalCount > 0 ? (
              <Pressable
                onPress={handleDeleteAllFlats}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.danger,
                }}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} style={{ marginRight: 4 }} />
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Delete All</Text>
              </Pressable>
            ) : null}
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
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New Flat</Text>
            </Pressable>
          </View>
        }
      />
      <OfflineBanner />

      {/* Project Selector Bar */}
      {projects && projects.length > 0 && (
        <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
            {projects.map((p) => {
              const active = p._id === selectedProjectId;
              return (
                <Pressable
                  key={p._id}
                  onPress={() => {
                    setSelectedProjectId(p._id);
                    setSelectedTowerId('');
                  }}
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

      {/* Tower Selector Pills */}
      {towers && towers.length > 0 && (
        <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
            <Pressable
              onPress={() => setSelectedTowerId('')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: radius.md,
                backgroundColor: !selectedTowerId ? colors.text : 'transparent',
                borderWidth: 1,
                borderColor: !selectedTowerId ? colors.text : colors.border,
              }}
            >
              <Text style={{ color: !selectedTowerId ? colors.background : colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                All Towers
              </Text>
            </Pressable>
            {towers.map((t) => {
              const active = t._id === selectedTowerId;
              return (
                <Pressable
                  key={t._id}
                  onPress={() => setSelectedTowerId(t._id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.text : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? colors.text : colors.border,
                  }}
                >
                  <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* KPI Counters */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingVertical: 10,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderColor: colors.border,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Total</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 }}>{totalCount}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.success, textTransform: 'uppercase' }}>Available</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.success, marginTop: 2 }}>{availableCount}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.warning, textTransform: 'uppercase' }}>Booked</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.warning, marginTop: 2 }}>{bookedCount}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.danger, textTransform: 'uppercase' }}>Sold</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.danger, marginTop: 2 }}>{soldCount}</Text>
        </View>
      </View>

      {/* Status & BHK Filter Bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: 10, gap: 8 }}>
        <Input
          placeholder="Search flat number (e.g. 201, 504)..."
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'available', 'booked', 'sold', 'blocked'].map((st) => {
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
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load flats'} onRetry={reload} />
        ) : filteredFlats.length === 0 ? (
          <EmptyState
            title="No Flats Match Criteria"
            message="Adjust filters or add a new residential flat unit."
            actionLabel="Add Flat"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {filteredFlats.map((flat) => (
              <Card key={flat._id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                        Flat {flat.unitNumber}
                      </Text>
                      {getStatusBadge(flat.status)}
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                      {flat.bedrooms ? `${flat.bedrooms} BHK` : 'Residential'} • {flat.towerName || 'Tower'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {flat.status === 'available' ? (
                      <Pressable
                        onPress={() => router.push(`/property/bookings?unitId=${flat._id}&projectId=${selectedProjectId}` as any)}
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radius.sm,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Book Now</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => handleDeleteFlat(flat._id, flat.unitNumber, flat.status)}
                      hitSlop={8}
                      style={{
                        padding: 6,
                        borderRadius: radius.sm,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={flat.status === 'available' ? colors.danger : colors.textFaint}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Specs */}
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
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Carpet Area</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {flat.carpetAreaSqmt ? `${flat.carpetAreaSqmt} sqmt` : flat.carpetAreaSqft ? `${flat.carpetAreaSqft} sqft` : '—'}
                    </Text>
                    {flat.carpetAreaSqmt && flat.carpetAreaSqft ? (
                      <Text style={{ fontSize: 10, color: colors.textFaint }}>{flat.carpetAreaSqft} sqft</Text>
                    ) : null}
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Built-Up</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {flat.builtUpAreaSqmt ? `${flat.builtUpAreaSqmt} sqmt` : flat.builtUpAreaSqft ? `${flat.builtUpAreaSqft} sqft` : '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>
                      {flat.saleDeedAmount ? 'Sale Deed' : 'Price'}
                    </Text>
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                      {formatCurrency(flat.saleDeedAmount || flat.finalPrice || flat.basePrice)}
                    </Text>
                  </View>
                </View>

                {/* Extra Sqmt tags if present */}
                {(flat.plotAreaSqmt || flat.balconyAreaSqmt || flat.terraceAreaSqmt) ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {flat.plotAreaSqmt ? (
                      <Badge tone="neutral" label={`Plot: ${flat.plotAreaSqmt} sqmt`} />
                    ) : null}
                    {flat.balconyAreaSqmt ? (
                      <Badge tone="neutral" label={`Wash/Balc: ${flat.balconyAreaSqmt} sqmt`} />
                    ) : null}
                    {flat.terraceAreaSqmt ? (
                      <Badge tone="orange" label={`Terrace: ${flat.terraceAreaSqmt} sqmt`} />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Flat Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              maxHeight: '90%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Residential Flat</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <Input
                label="Flat Number *"
                placeholder="e.g. 101, 302, 1204"
                value={flatNumber}
                onChangeText={setFlatNumber}
              />
              <Input
                label="Bedrooms (BHK)"
                placeholder="e.g. 1, 2, 3, 4"
                keyboardType="number-pad"
                value={bedrooms}
                onChangeText={setBedrooms}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Carpet Area (sq.ft.)"
                    placeholder="e.g. 750"
                    keyboardType="numeric"
                    value={carpetArea}
                    onChangeText={setCarpetArea}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Built-Up Area (sq.ft.)"
                    placeholder="e.g. 980"
                    keyboardType="numeric"
                    value={builtUpArea}
                    onChangeText={setBuiltUpArea}
                  />
                </View>
              </View>

              <Input
                label="Base Price (₹)"
                placeholder="e.g. 4500000"
                keyboardType="numeric"
                value={basePrice}
                onChangeText={setBasePrice}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Parking Slot"
                    placeholder="e.g. B1-24"
                    value={parkingSlot}
                    onChangeText={setParkingSlot}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Parking Charges (₹)"
                    placeholder="e.g. 150000"
                    keyboardType="numeric"
                    value={parkingCharges}
                    onChangeText={setParkingCharges}
                  />
                </View>
              </View>

              <Button
                label={submitting ? 'Creating Flat...' : 'Create Flat'}
                onPress={handleCreate}
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
