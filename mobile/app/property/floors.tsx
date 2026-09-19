import React, { useState, useEffect } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View, Pressable, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { PropertyProject, PropertyTower, PropertyFloor } from '@/types';

export default function PropertyFloorsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; towerId?: string }>();
  const { colors, spacing, radius } = theme;

  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.projectId || '');
  const [selectedTowerId, setSelectedTowerId] = useState<string>(params.towerId || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [floorNumber, setFloorNumber] = useState('');
  const [floorName, setFloorName] = useState('');
  const [totalUnits, setTotalUnits] = useState('');

  // Fetch projects
  const { data: projects, loading: loadingProjects } = useResource<PropertyProject[]>(
    () => propertyService.listProjects(),
    [],
  );

  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  // Fetch towers for selected project
  const { data: towers, loading: loadingTowers } = useResource<PropertyTower[]>(
    () => (selectedProjectId ? propertyService.listTowers(selectedProjectId) : Promise.resolve([])),
    [selectedProjectId],
  );

  useEffect(() => {
    if (towers && towers.length > 0 && (!selectedTowerId || !towers.some((t) => t._id === selectedTowerId))) {
      setSelectedTowerId(towers[0]._id);
    }
  }, [towers, selectedTowerId]);

  // Fetch floors
  const {
    data: floors,
    loading: loadingFloors,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyFloor[]>(
    () =>
      selectedProjectId && selectedTowerId
        ? propertyService.listFloors(selectedProjectId, selectedTowerId)
        : Promise.resolve([]),
    [selectedProjectId, selectedTowerId],
  );

  const handleCreate = async () => {
    if (!selectedProjectId || !selectedTowerId) {
      showToast('Please select Project and Tower first', 'error');
      return;
    }
    if (!floorNumber.trim()) {
      showToast('Floor number is required (e.g. 1, 2, or Ground)', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await propertyService.createFloor(selectedProjectId, selectedTowerId, {
        floorNumber: floorNumber.trim(),
        name: floorName.trim() || `Floor ${floorNumber.trim()}`,
        totalUnits: totalUnits ? Number(totalUnits) : undefined,
      });
      showToast('Floor created successfully', 'success');
      setModalOpen(false);
      setFloorNumber('');
      setFloorName('');
      setTotalUnits('');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create floor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFloor = (floor: PropertyFloor) => {
    Alert.alert(
      'Delete Floor Level',
      `Are you sure you want to delete "${floor.name || `Floor ${floor.floorNumber}`}"?\n\nThis will permanently remove this floor level and its associated units.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteFloor(floor._id);
              showToast(`Floor "${floor.name || floor.floorNumber}" deleted successfully`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete floor', 'error');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Floors"
        subtitle="Configure levels, storeys and floor layouts"
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
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New Floor</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Project Selector Pills */}
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

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {loadingProjects || loadingTowers || loadingFloors ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load floors'} onRetry={reload} />
        ) : !towers || towers.length === 0 ? (
          <EmptyState
            title="No Towers Available"
            message="Add a Tower to this project before creating floors."
            actionLabel="Add Tower"
            onAction={() => router.push(`/property/towers?projectId=${selectedProjectId}` as any)}
          />
        ) : !floors || floors.length === 0 ? (
          <EmptyState
            title="No Floors Configured"
            message="Add floor levels (e.g. Ground, 1st, 2nd, etc.) to this tower."
            actionLabel="Add Floor"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {floors.map((floor) => (
              <Card key={floor._id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                      {floor.name || `Floor ${floor.floorNumber}`}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      Floor Level: {floor.floorNumber}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/property/flats?projectId=${selectedProjectId}&towerId=${selectedTowerId}&floorId=${floor._id}` as any,
                        )
                      }
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
                      <Ionicons name="grid-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>View Units</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteFloor(floor)}
                      hitSlop={8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.danger,
                        gap: 3,
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.danger }}>Delete</Text>
                    </Pressable>
                  </View>
                </View>

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
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Configured Units</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {floor.totalUnits ?? '—'}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Floor Index</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {floor.orderIndex ?? floor.floorNumber}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Floor Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Floor</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={{ gap: 14 }}>
              <Input
                label="Floor Number *"
                placeholder="e.g. 1, 2, Ground, Basement"
                value={floorNumber}
                onChangeText={setFloorNumber}
              />
              <Input
                label="Floor Display Name (Optional)"
                placeholder="e.g. First Floor / Ground Level"
                value={floorName}
                onChangeText={setFloorName}
              />
              <Input
                label="Total Units on this Floor"
                placeholder="e.g. 4"
                keyboardType="number-pad"
                value={totalUnits}
                onChangeText={setTotalUnits}
              />

              <Button
                label={submitting ? 'Adding...' : 'Add Floor'}
                onPress={handleCreate}
                disabled={submitting}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
