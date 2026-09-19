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

export default function PropertyShopsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; towerId?: string; floorId?: string }>();
  const { colors, spacing, radius } = theme;

  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.projectId || '');
  const [selectedTowerId, setSelectedTowerId] = useState<string>(params.towerId || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
  const [editUnitType, setEditUnitType] = useState('Commercial Shop');
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

  // New Shop Form State
  const [formFloorId, setFormFloorId] = useState(params.floorId || '');
  const [shopNumber, setShopNumber] = useState('');
  const [carpetArea, setCarpetArea] = useState('');
  const [builtUpArea, setBuiltUpArea] = useState('');
  const [basePrice, setBasePrice] = useState('');

  const handleOpenUnit = (unit: PropertyUnit) => {
    setSelectedUnit(unit);
    setIsEditMode(false);
    setEditUnitNumber(unit.unitNumber || '');
    setEditUnitType(unit.unitType || 'Commercial Shop');
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
        unitType: editUnitType.trim() || 'Commercial Shop',
        category: 'shop',
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
      showToast(`Shop ${updated.unitNumber} updated successfully`, 'success');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to update shop', 'error');
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

  // Fetch shops
  const {
    data: shops,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyUnit[]>(
    () =>
      selectedProjectId
        ? propertyService.listShops(selectedProjectId, {
            towerId: selectedTowerId || undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
          })
        : Promise.resolve([]),
    [selectedProjectId, selectedTowerId, statusFilter],
  );

  const filteredShops = (shops || []).filter((shop) => {
    if (search.trim()) {
      return shop.unitNumber.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const totalCount = shops?.length || 0;
  const availableCount = shops?.filter((s) => s.status === 'available').length || 0;
  const bookedCount = shops?.filter((s) => s.status === 'booked').length || 0;
  const soldCount = shops?.filter((s) => s.status === 'sold').length || 0;

  const handleCreate = async () => {
    if (!selectedProjectId) {
      showToast('Select project first', 'error');
      return;
    }
    if (!shopNumber.trim()) {
      showToast('Shop / Commercial unit number is required (e.g. S-01, G-12)', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const area = Number(carpetArea || builtUpArea || 250);
      const price = Number(basePrice || 0);
      await propertyService.createShop(selectedProjectId, {
        unitNumber: shopNumber.trim(),
        towerId: selectedTowerId || undefined,
        floorId: formFloorId || undefined,
        unitType: 'Shop',
        carpetAreaSqft: carpetArea ? Number(carpetArea) : area,
        builtUpAreaSqft: builtUpArea ? Number(builtUpArea) : area,
        areaSqft: area,
        basePrice: basePrice ? Number(basePrice) : undefined,
        totalValue: price,
      });
      showToast('Commercial unit created successfully', 'success');
      setModalOpen(false);
      setShopNumber('');
      setCarpetArea('');
      setBuiltUpArea('');
      setBasePrice('');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create shop', 'error');
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
      default:
        return <Badge tone="neutral" label={status} />;
    }
  };

  const handleDeleteShop = (shopId: string, unitNum: string, status: string) => {
    const isBookedOrSold = status === 'booked' || status === 'sold';
    const title = isBookedOrSold ? `Delete ${status.toUpperCase()} Shop` : 'Delete Shop';
    const message = isBookedOrSold
      ? `Commercial Shop ${unitNum} is currently marked as "${status.toUpperCase()}". Deleting it will permanently remove the unit and cancel any associated customer booking records. Are you sure you want to proceed?`
      : `Are you sure you want to delete Commercial Shop ${unitNum}? This action cannot be undone.`;

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
              await propertyService.deleteShop(shopId);
              showToast(`Shop ${unitNum} deleted`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete shop', 'error');
            }
          },
        },
      ],
    );
  };

  const handleDeleteAllShops = () => {
    if (!selectedProjectId) {
      showToast('Select project first', 'error');
      return;
    }

    Alert.alert(
      'Delete Commercial Units in Project',
      'Select deletion scope for commercial shops in this project:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Available Only',
          onPress: async () => {
            try {
              const res = await propertyService.deleteAllUnits({
                projectId: selectedProjectId,
                category: 'shop',
                includeBookedSold: false,
              });
              showToast(res.message || `Deleted ${res.deletedCount} available commercial units`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete shops', 'error');
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
                category: 'shop',
                includeBookedSold: true,
              });
              showToast(res.message || `Deleted all ${res.deletedCount} commercial units`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete all shops', 'error');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Commercial Shops"
        subtitle="Retail outlets, showrooms & office spaces"
        large
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {totalCount > 0 ? (
              <Pressable
                onPress={handleDeleteAllShops}
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
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New Shop</Text>
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

      {/* Filter Bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: 10, gap: 8 }}>
        <Input
          placeholder="Search shop number (e.g. S-01, G-12)..."
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'available', 'booked', 'sold'].map((st) => {
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
            <Skeleton height={100} />
            <Skeleton height={100} />
            <Skeleton height={100} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load commercial units'} onRetry={reload} />
        ) : filteredShops.length === 0 ? (
          <EmptyState
            title="No Commercial Shops Found"
            message="Add ground floor retail shops or commercial office spaces."
            actionLabel="Add Shop"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {filteredShops.map((shop) => (
              <Pressable key={shop._id} onPress={() => handleOpenUnit(shop)}>
                <Card style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                          Shop {shop.unitNumber}
                        </Text>
                        {getStatusBadge(shop.status)}
                      </View>
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                        {shop.unitType || 'Commercial Retail'} • {shop.towerName || 'Ground Complex'} • {shop.floorName || 'Ground Floor'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {shop.status === 'available' ? (
                        <Pressable
                          onPress={() => router.push(`/property/bookings?unitId=${shop._id}&projectId=${selectedProjectId}` as any)}
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
                        onPress={() => handleDeleteShop(shop._id, shop.unitNumber, shop.status)}
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
                        {shop.carpetAreaSqmt !== undefined && shop.carpetAreaSqmt !== null
                          ? `${formatDecimal(shop.carpetAreaSqmt)} sqmt`
                          : shop.carpetAreaSqft ? `${formatDecimal(shop.carpetAreaSqft)} sqft` : '—'}
                      </Text>
                      {shop.carpetAreaSqmt && shop.carpetAreaSqft ? (
                        <Text style={{ fontSize: 10.5, color: colors.textFaint }}>{formatDecimal(shop.carpetAreaSqft)} sqft</Text>
                      ) : null}
                    </View>
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Built-Up</Text>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                        {shop.builtUpAreaSqmt !== undefined && shop.builtUpAreaSqmt !== null
                          ? `${formatDecimal(shop.builtUpAreaSqmt)} sqmt`
                          : shop.builtUpAreaSqft ? `${formatDecimal(shop.builtUpAreaSqft)} sqft` : '—'}
                      </Text>
                      {shop.builtUpAreaSqmt && shop.builtUpAreaSqft ? (
                        <Text style={{ fontSize: 10.5, color: colors.textFaint }}>{formatDecimal(shop.builtUpAreaSqft)} sqft</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>
                        {shop.saleDeedAmount ? 'Sale Deed' : 'Price'}
                      </Text>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                        ₹{formatDecimal(shop.saleDeedAmount || shop.finalPrice || shop.basePrice)}
                      </Text>
                    </View>
                  </View>

                  {/* Extra Sqmt tags if present */}
                  {(shop.plotAreaSqmt || shop.balconyAreaSqmt || shop.terraceAreaSqmt) ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {shop.plotAreaSqmt ? (
                        <Badge tone="neutral" label={`Plot: ${formatDecimal(shop.plotAreaSqmt)} sqmt`} />
                      ) : null}
                      {shop.balconyAreaSqmt ? (
                        <Badge tone="neutral" label={`Wash/Balc: ${formatDecimal(shop.balconyAreaSqmt)} sqmt`} />
                      ) : null}
                      {shop.terraceAreaSqmt ? (
                        <Badge tone="orange" label={`Terrace: ${formatDecimal(shop.terraceAreaSqmt)} sqmt`} />
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
                  Shop {selectedUnit?.unitNumber}
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
                    {isEditMode ? 'View Mode' : '✎ Edit Shop'}
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
                          label="1. Shop No. *"
                          placeholder="e.g. SHOP-01"
                          value={editUnitNumber}
                          onChangeText={setEditUnitNumber}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="2. Commercial Type"
                          placeholder="e.g. Retail Shop, Showroom"
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
                          placeholder="e.g. 18.50"
                          keyboardType="numeric"
                          value={editPlotAreaSqmt}
                          onChangeText={setEditPlotAreaSqmt}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="5. Built up Area In Sqmt"
                          placeholder="e.g. 45.00"
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
                          placeholder="e.g. 38.20"
                          keyboardType="numeric"
                          value={editCarpetAreaSqmt}
                          onChangeText={setEditCarpetAreaSqmt}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="7. Wash & Balcony In Sqmt"
                          placeholder="e.g. 0.00"
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
                          placeholder="e.g. 0.00"
                          keyboardType="numeric"
                          value={editTerraceAreaSqmt}
                          onChangeText={setEditTerraceAreaSqmt}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="9. Sale deed Amount (₹)"
                          placeholder="e.g. 5200000"
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
                          placeholder="e.g. 10000"
                          keyboardType="numeric"
                          value={editRatePerSqft}
                          onChangeText={setEditRatePerSqft}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="Parking Slot"
                          placeholder="e.g. P-Shop-01"
                          value={editParkingSlot}
                          onChangeText={setEditParkingSlot}
                        />
                      </View>
                    </View>

                    <Input
                      label="Notes / Remarks"
                      placeholder="Commercial frontage, road facing, corner, etc."
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
                          { label: '1. Shop / Unit Number', value: selectedUnit.unitNumber },
                          { label: '2. Project Name', value: projects?.find((p) => p._id === (selectedProjectId || selectedUnit.projectId))?.name || 'Santora' },
                          { label: '3. Block / Tower', value: selectedUnit.towerName || 'Commercial Complex' },
                          { label: '4. Floor Level', value: selectedUnit.floorName || 'Ground Floor' },
                          { label: '5. Category / Type', value: selectedUnit.unitType || 'Commercial Shop' },
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
                          {selectedUnit.facing || 'Road Facing'}
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
                      label="✎ Edit This Shop (All Columns)"
                      onPress={() => setIsEditMode(true)}
                    />
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* New Shop Modal */}
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Commercial Shop</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <Input
                label="Shop / Unit Number *"
                placeholder="e.g. S-01, G-12, Showroom 1"
                value={shopNumber}
                onChangeText={setShopNumber}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Carpet Area (sq.ft.)"
                    placeholder="e.g. 450"
                    keyboardType="numeric"
                    value={carpetArea}
                    onChangeText={setCarpetArea}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Built-Up Area (sq.ft.)"
                    placeholder="e.g. 620"
                    keyboardType="numeric"
                    value={builtUpArea}
                    onChangeText={setBuiltUpArea}
                  />
                </View>
              </View>

              <Input
                label="Base Price (₹)"
                placeholder="e.g. 7500000"
                keyboardType="numeric"
                value={basePrice}
                onChangeText={setBasePrice}
              />

              <Button
                label={submitting ? 'Creating Shop...' : 'Create Commercial Unit'}
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
