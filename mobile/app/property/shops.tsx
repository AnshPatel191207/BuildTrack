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

  // New Shop Form State
  const [formFloorId, setFormFloorId] = useState(params.floorId || '');
  const [shopNumber, setShopNumber] = useState('');
  const [carpetArea, setCarpetArea] = useState('');
  const [builtUpArea, setBuiltUpArea] = useState('');
  const [basePrice, setBasePrice] = useState('');

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
    if (status === 'booked' || status === 'sold') {
      Alert.alert(
        'Cannot Delete Unit',
        `Shop ${unitNum} is currently marked as "${status}". Units with active bookings or sales cannot be deleted to preserve financial audit integrity.`,
      );
      return;
    }

    Alert.alert(
      'Delete Shop',
      `Are you sure you want to delete Commercial Shop ${unitNum}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
      'Delete All Commercial Shops',
      'Are you sure you want to delete all available shops in this project? Booked/Sold units with customer records will be safely preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Available',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await propertyService.deleteAllUnits({
                projectId: selectedProjectId,
                category: 'shop',
              });
              showToast(res.message || `Deleted ${res.deletedCount} commercial units`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete shops', 'error');
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
              <Card key={shop._id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                        Shop {shop.unitNumber}
                      </Text>
                      {getStatusBadge(shop.status)}
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                      Commercial Retail • {shop.towerName || 'Ground Complex'}
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
                        color={shop.status === 'available' ? colors.danger : colors.textFaint}
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
                      {shop.carpetAreaSqmt ? `${shop.carpetAreaSqmt} sqmt` : shop.carpetAreaSqft ? `${shop.carpetAreaSqft} sqft` : '—'}
                    </Text>
                    {shop.carpetAreaSqmt && shop.carpetAreaSqft ? (
                      <Text style={{ fontSize: 10, color: colors.textFaint }}>{shop.carpetAreaSqft} sqft</Text>
                    ) : null}
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Built-Up</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {shop.builtUpAreaSqmt ? `${shop.builtUpAreaSqmt} sqmt` : shop.builtUpAreaSqft ? `${shop.builtUpAreaSqft} sqft` : '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>
                      {shop.saleDeedAmount ? 'Sale Deed' : 'Price'}
                    </Text>
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                      {formatCurrency(shop.saleDeedAmount || shop.finalPrice || shop.basePrice)}
                    </Text>
                  </View>
                </View>

                {/* Extra Sqmt tags if present */}
                {(shop.plotAreaSqmt || shop.balconyAreaSqmt || shop.terraceAreaSqmt) ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {shop.plotAreaSqmt ? (
                      <Badge tone="neutral" label={`Plot: ${shop.plotAreaSqmt} sqmt`} />
                    ) : null}
                    {shop.balconyAreaSqmt ? (
                      <Badge tone="neutral" label={`Wash/Balc: ${shop.balconyAreaSqmt} sqmt`} />
                    ) : null}
                    {shop.terraceAreaSqmt ? (
                      <Badge tone="orange" label={`Terrace: ${shop.terraceAreaSqmt} sqmt`} />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

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
