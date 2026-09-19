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

function formatDecimal(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0.00';
  const n = Number(val);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Unit Detail & Edit Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<PropertyUnit | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);

  // Edit form state for all 11 columns
  const [editUnitNumber, setEditUnitNumber] = useState('');
  const [editUnitType, setEditUnitType] = useState('');
  const [editStatus, setEditStatus] = useState<string>('available');
  const [editPlotAreaSqmt, setEditPlotAreaSqmt] = useState('');
  const [editBuiltUpAreaSqmt, setEditBuiltUpAreaSqmt] = useState('');
  const [editCarpetAreaSqmt, setEditCarpetAreaSqmt] = useState('');
  const [editBalconyAreaSqmt, setEditBalconyAreaSqmt] = useState('');
  const [editTerraceAreaSqmt, setEditTerraceAreaSqmt] = useState('');
  const [editSaleDeedAmount, setEditSaleDeedAmount] = useState('');
  const [editCarpetAreaSqft, setEditCarpetAreaSqft] = useState('');
  const [editBuiltUpAreaSqft, setEditBuiltUpAreaSqft] = useState('');
  const [editRatePerSqft, setEditRatePerSqft] = useState('');
  const [editParkingSlot, setEditParkingSlot] = useState('');
  const [editFacing, setEditFacing] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // New Flat Form State
  const [formFloorId, setFormFloorId] = useState(params.floorId || '');
  const [flatNumber, setFlatNumber] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [carpetArea, setCarpetArea] = useState('');
  const [builtUpArea, setBuiltUpArea] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [parkingSlot, setParkingSlot] = useState('');
  const [parkingCharges, setParkingCharges] = useState('');

  const handleOpenUnit = (unit: PropertyUnit) => {
    setSelectedUnit(unit);
    setIsEditMode(false);
    setEditUnitNumber(unit.unitNumber || '');
    setEditUnitType(unit.unitType || '');
    setEditStatus(unit.status || 'available');
    setEditPlotAreaSqmt(unit.plotAreaSqmt !== undefined && unit.plotAreaSqmt !== null ? String(unit.plotAreaSqmt) : '');
    setEditBuiltUpAreaSqmt(unit.builtUpAreaSqmt !== undefined && unit.builtUpAreaSqmt !== null ? String(unit.builtUpAreaSqmt) : '');
    setEditCarpetAreaSqmt(unit.carpetAreaSqmt !== undefined && unit.carpetAreaSqmt !== null ? String(unit.carpetAreaSqmt) : '');
    setEditBalconyAreaSqmt(unit.balconyAreaSqmt !== undefined && unit.balconyAreaSqmt !== null ? String(unit.balconyAreaSqmt) : '');
    setEditTerraceAreaSqmt(unit.terraceAreaSqmt !== undefined && unit.terraceAreaSqmt !== null ? String(unit.terraceAreaSqmt) : '');
    setEditSaleDeedAmount(
      unit.saleDeedAmount !== undefined && unit.saleDeedAmount !== null && unit.saleDeedAmount > 0
        ? String(unit.saleDeedAmount)
        : unit.basePrice ? String(unit.basePrice) : ''
    );
    setEditCarpetAreaSqft(unit.carpetAreaSqft !== undefined && unit.carpetAreaSqft !== null ? String(unit.carpetAreaSqft) : '');
    setEditBuiltUpAreaSqft(unit.builtUpAreaSqft !== undefined && unit.builtUpAreaSqft !== null ? String(unit.builtUpAreaSqft) : '');
    setEditRatePerSqft(unit.ratePerSqft !== undefined && unit.ratePerSqft !== null ? String(unit.ratePerSqft) : '');
    setEditParkingSlot(unit.parkingSlot || '');
    setEditFacing(unit.facing || '');
    setEditNotes(unit.notes || '');
    setDetailModalOpen(true);
  };

  const handleSaveUnitChanges = async () => {
    if (!selectedUnit) return;
    setSavingUnit(true);
    try {
      const plotSqmt = editPlotAreaSqmt ? Number(editPlotAreaSqmt) : 0;
      const builtUpSqmt = editBuiltUpAreaSqmt ? Number(editBuiltUpAreaSqmt) : 0;
      const carpetSqmt = editCarpetAreaSqmt ? Number(editCarpetAreaSqmt) : 0;
      const balconySqmt = editBalconyAreaSqmt ? Number(editBalconyAreaSqmt) : 0;
      const terraceSqmt = editTerraceAreaSqmt ? Number(editTerraceAreaSqmt) : 0;
      const saleDeed = editSaleDeedAmount ? Number(editSaleDeedAmount) : 0;

      const carpetSqft = editCarpetAreaSqft ? Number(editCarpetAreaSqft) : (carpetSqmt > 0 ? Number((carpetSqmt * 10.7639).toFixed(2)) : 0);
      const builtUpSqft = editBuiltUpAreaSqft ? Number(editBuiltUpAreaSqft) : (builtUpSqmt > 0 ? Number((builtUpSqmt * 10.7639).toFixed(2)) : 0);

      const updated = await propertyService.updateUnit(selectedUnit._id, {
        unitNumber: editUnitNumber.trim().toUpperCase(),
        unitType: editUnitType.trim(),
        status: editStatus as any,
        plotAreaSqmt: plotSqmt,
        builtUpAreaSqmt: builtUpSqmt,
        carpetAreaSqmt: carpetSqmt,
        balconyAreaSqmt: balconySqmt,
        terraceAreaSqmt: terraceSqmt,
        saleDeedAmount: saleDeed,
        carpetAreaSqft: carpetSqft,
        builtUpAreaSqft: builtUpSqft,
        areaSqft: builtUpSqft || carpetSqft,
        ratePerSqft: editRatePerSqft ? Number(editRatePerSqft) : 0,
        basePrice: saleDeed,
        totalValue: saleDeed,
        parkingSlot: editParkingSlot.trim() || null,
        facing: editFacing.trim() || null,
        notes: editNotes.trim() || null,
      });

      setSelectedUnit(updated);
      setIsEditMode(false);
      showToast(`Flat ${updated.unitNumber} updated successfully`, 'success');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to update flat', 'error');
    } finally {
      setSavingUnit(false);
    }
  };

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
    const isBookedOrSold = status === 'booked' || status === 'sold';
    const title = isBookedOrSold ? `Delete ${status.toUpperCase()} Flat` : 'Delete Flat';
    const message = isBookedOrSold
      ? `Flat ${unitNum} is currently marked as "${status.toUpperCase()}". Deleting it will permanently remove the unit and cancel any associated customer booking records. Are you sure you want to proceed?`
      : `Are you sure you want to delete Flat ${unitNum}? This action cannot be undone.`;

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBookedOrSold ? 'Delete & Cancel Booking' : 'Delete',
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
      'Delete Flats in Project',
      'Select deletion scope for residential flats in this project:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Available Only',
          onPress: async () => {
            try {
              const res = await propertyService.deleteAllUnits({
                projectId: selectedProjectId,
                category: 'flat',
                includeBookedSold: false,
              });
              showToast(res.message || `Deleted ${res.deletedCount} available flats`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete flats', 'error');
            }
          },
        },
        {
          text: 'Delete ALL (Including Booked & Sold)',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await propertyService.deleteAllUnits({
                projectId: selectedProjectId,
                category: 'flat',
                includeBookedSold: true,
              });
              showToast(res.message || `Deleted all ${res.deletedCount} flats`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete all flats', 'error');
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
              <Pressable key={flat._id} onPress={() => handleOpenUnit(flat)}>
                <Card style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                          Flat {flat.unitNumber}
                        </Text>
                        {getStatusBadge(flat.status)}
                      </View>
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                        {flat.bedrooms ? `${flat.bedrooms} BHK` : 'Residential'} • {flat.towerName || 'Tower'} • {flat.floorName || '1st Floor'}
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
                          color={colors.danger}
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Specs in 2 decimal format */}
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
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>RERA Carpet</Text>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                        {flat.carpetAreaSqmt !== undefined && flat.carpetAreaSqmt !== null
                          ? `${formatDecimal(flat.carpetAreaSqmt)} sqmt`
                          : flat.carpetAreaSqft ? `${formatDecimal(flat.carpetAreaSqft)} sqft` : '—'}
                      </Text>
                      {flat.carpetAreaSqmt && flat.carpetAreaSqft ? (
                        <Text style={{ fontSize: 10.5, color: colors.textFaint }}>{formatDecimal(flat.carpetAreaSqft)} sqft</Text>
                      ) : null}
                    </View>
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Built-Up</Text>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                        {flat.builtUpAreaSqmt !== undefined && flat.builtUpAreaSqmt !== null
                          ? `${formatDecimal(flat.builtUpAreaSqmt)} sqmt`
                          : flat.builtUpAreaSqft ? `${formatDecimal(flat.builtUpAreaSqft)} sqft` : '—'}
                      </Text>
                      {flat.builtUpAreaSqmt && flat.builtUpAreaSqft ? (
                        <Text style={{ fontSize: 10.5, color: colors.textFaint }}>{formatDecimal(flat.builtUpAreaSqft)} sqft</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>
                        {flat.saleDeedAmount ? 'Sale Deed' : 'Price'}
                      </Text>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                        ₹{formatDecimal(flat.saleDeedAmount || flat.finalPrice || flat.basePrice)}
                      </Text>
                    </View>
                  </View>

                  {/* Extra Sqmt tags if present */}
                  {(flat.plotAreaSqmt || flat.balconyAreaSqmt || flat.terraceAreaSqmt) ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {flat.plotAreaSqmt ? (
                        <Badge tone="neutral" label={`Plot: ${formatDecimal(flat.plotAreaSqmt)} sqmt`} />
                      ) : null}
                      {flat.balconyAreaSqmt ? (
                        <Badge tone="neutral" label={`Wash/Balc: ${formatDecimal(flat.balconyAreaSqmt)} sqmt`} />
                      ) : null}
                      {flat.terraceAreaSqmt ? (
                        <Badge tone="orange" label={`Terrace: ${formatDecimal(flat.terraceAreaSqmt)} sqmt`} />
                      ) : null}
                    </View>
                  ) : null}

                  <Text style={{ fontSize: 11, color: colors.primary, marginTop: 8, fontWeight: '600', textAlign: 'right' }}>
                    Tap to view & edit all 11 columns →
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── UNIT DETAIL & EDIT MODAL (ALL 11 COLUMNS) ── */}
      <Modal visible={detailModalOpen} transparent animationType="slide" onRequestClose={() => setDetailModalOpen(false)}>
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
            {/* Header with Mode Toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                  Flat {selectedUnit?.unitNumber}
                </Text>
                {selectedUnit ? getStatusBadge(selectedUnit.status) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  onPress={() => setIsEditMode(!isEditMode)}
                  style={{
                    backgroundColor: isEditMode ? colors.primaryMuted : colors.surfaceAlt,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: isEditMode ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isEditMode ? colors.primary : colors.text }}>
                    {isEditMode ? 'View Mode' : '✎ Edit Unit'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setDetailModalOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {selectedUnit ? (
              <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
                {isEditMode ? (
                  /* ── EDIT MODE (ALL 11 EXCEL COLUMNS EDITABLE) ── */
                  <View style={{ gap: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                      Editing All 11 Excel Inventory Fields:
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="1. Flat No. *"
                          placeholder="e.g. A-101"
                          value={editUnitNumber}
                          onChangeText={setEditUnitNumber}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="2. Unit Type / BHK"
                          placeholder="e.g. 2BHK Flat"
                          value={editUnitType}
                          onChangeText={setEditUnitType}
                        />
                      </View>
                    </View>

                    {/* Status Picker Buttons */}
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 12, color: colors.textFaint, fontWeight: '600' }}>3. Unit Status</Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {['available', 'reserved', 'booked', 'sold', 'blocked'].map((st) => {
                          const active = editStatus === st;
                          return (
                            <Pressable
                              key={st}
                              onPress={() => setEditStatus(st)}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: radius.sm,
                                backgroundColor: active ? colors.primary : colors.surfaceAlt,
                                borderWidth: 1,
                                borderColor: active ? colors.primary : colors.border,
                              }}
                            >
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: active ? '#fff' : colors.textMuted, textTransform: 'capitalize' }}>
                                {st}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    {/* Sqmt Fields */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="4. Prop. Plot Area In Sqmt"
                          placeholder="e.g. 25.85"
                          keyboardType="numeric"
                          value={editPlotAreaSqmt}
                          onChangeText={setEditPlotAreaSqmt}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="5. Built up Area In Sqmt"
                          placeholder="e.g. 68.80"
                          keyboardType="numeric"
                          value={editBuiltUpAreaSqmt}
                          onChangeText={setEditBuiltUpAreaSqmt}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="6. RERA Carpet Area In Sqmt"
                          placeholder="e.g. 60.35"
                          keyboardType="numeric"
                          value={editCarpetAreaSqmt}
                          onChangeText={setEditCarpetAreaSqmt}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="7. Wash & Balcony In Sqmt"
                          placeholder="e.g. 4.59"
                          keyboardType="numeric"
                          value={editBalconyAreaSqmt}
                          onChangeText={setEditBalconyAreaSqmt}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="8. Open Terrace In Sqmt"
                          placeholder="e.g. 43.18"
                          keyboardType="numeric"
                          value={editTerraceAreaSqmt}
                          onChangeText={setEditTerraceAreaSqmt}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="9. Sale deed Amount (₹)"
                          placeholder="e.g. 4040000"
                          keyboardType="numeric"
                          value={editSaleDeedAmount}
                          onChangeText={setEditSaleDeedAmount}
                        />
                      </View>
                    </View>

                    {/* Optional Sqft / Price Overrides */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="10. Carpet Area Sqft"
                          placeholder="Auto: Sqmt × 10.76"
                          keyboardType="numeric"
                          value={editCarpetAreaSqft}
                          onChangeText={setEditCarpetAreaSqft}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="11. Built-Up Sqft"
                          placeholder="Auto: Sqmt × 10.76"
                          keyboardType="numeric"
                          value={editBuiltUpAreaSqft}
                          onChangeText={setEditBuiltUpAreaSqft}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="Rate / Sqft (₹)"
                          placeholder="e.g. 4500"
                          keyboardType="numeric"
                          value={editRatePerSqft}
                          onChangeText={setEditRatePerSqft}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="Parking Slot"
                          placeholder="e.g. P-12"
                          value={editParkingSlot}
                          onChangeText={setEditParkingSlot}
                        />
                      </View>
                    </View>

                    <Input
                      label="Notes / Remarks"
                      placeholder="Optional notes or specifications"
                      value={editNotes}
                      onChangeText={setEditNotes}
                    />

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <Button
                        label="Cancel"
                        variant="secondary"
                        onPress={() => setIsEditMode(false)}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={savingUnit ? 'Saving Changes…' : 'Save Changes'}
                        onPress={handleSaveUnitChanges}
                        disabled={savingUnit}
                        loading={savingUnit}
                        style={{ flex: 2 }}
                      />
                    </View>
                  </View>
                ) : (
                  /* ── VIEW MODE (SHOWING ALL 11 EXCEL COLUMNS IN 2-DECIMAL PRECISION) ── */
                  <View style={{ gap: 12 }}>
                    <Card style={{ padding: 14, gap: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
                        Excel Inventory Columns (11 Fields)
                      </Text>

                      <View style={{ gap: 8 }}>
                        {[
                          { label: '1. Flat / Unit Number', value: selectedUnit.unitNumber },
                          { label: '2. Project Name', value: projects?.find((p) => p._id === (selectedProjectId || selectedUnit.projectId))?.name || 'Santora' },
                          { label: '3. Block / Tower', value: selectedUnit.towerName || 'A' },
                          { label: '4. Floor Level', value: selectedUnit.floorName || '1st Floor' },
                          { label: '5. Unit Type / Category', value: selectedUnit.unitType || (selectedUnit.bedrooms ? `${selectedUnit.bedrooms} BHK Flat` : 'Residential Flat') },
                          { label: '6. Prop. Plot Area In Sqmt', value: `${formatDecimal(selectedUnit.plotAreaSqmt)} sqmt` },
                          {
                            label: '7. Unit Built up Area In Sqmt',
                            value: `${formatDecimal(selectedUnit.builtUpAreaSqmt)} sqmt (${formatDecimal(selectedUnit.builtUpAreaSqft || selectedUnit.areaSqft)} sqft)`
                          },
                          {
                            label: '8. Rera Carpet Area In Sqmt',
                            value: `${formatDecimal(selectedUnit.carpetAreaSqmt)} sqmt (${formatDecimal(selectedUnit.carpetAreaSqft || selectedUnit.areaSqft)} sqft)`
                          },
                          { label: '9. Wash & Balcony Area In Sqmt', value: `${formatDecimal(selectedUnit.balconyAreaSqmt)} sqmt` },
                          { label: '10. Open Terrace In Sqmt', value: `${formatDecimal(selectedUnit.terraceAreaSqmt)} sqmt` },
                          {
                            label: '11. Sale deed Amount',
                            value: `₹${formatDecimal(selectedUnit.saleDeedAmount || selectedUnit.finalPrice || selectedUnit.totalValue)}`
                          },
                        ].map((col, idx) => (
                          <View
                            key={idx}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingVertical: 5,
                              borderBottomWidth: idx < 10 ? 1 : 0,
                              borderColor: colors.border,
                            }}
                          >
                            <Text style={{ fontSize: 12, color: colors.textFaint, flex: 1.2 }}>{col.label}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'right' }}>
                              {col.value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </Card>

                    {/* Additional Specifications */}
                    <Card style={{ padding: 14, gap: 8 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                        Additional Specifications
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: colors.textFaint }}>Rate per Sqft</Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                          ₹{formatDecimal(selectedUnit.ratePerSqft)} / sqft
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: colors.textFaint }}>Parking Slot</Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                          {selectedUnit.parkingSlot || 'None'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: colors.textFaint }}>Facing Direction</Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                          {selectedUnit.facing || '—'}
                        </Text>
                      </View>
                      {selectedUnit.notes ? (
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ fontSize: 11, color: colors.textFaint }}>Notes</Text>
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{selectedUnit.notes}</Text>
                        </View>
                      ) : null}
                    </Card>

                    <Button
                      label="✎ Edit This Unit (All Columns)"
                      onPress={() => setIsEditMode(true)}
                    />
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

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
