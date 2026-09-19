import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
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
import type { PropertyProject, PropertyTower } from '@/types';

export default function PropertyTowersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [towerName, setTowerName] = useState('');
  const [towerNumber, setTowerNumber] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [totalUnits, setTotalUnits] = useState('');

  // Fetch projects for selector
  const { data: projects, loading: loadingProjects } = useResource<PropertyProject[]>(
    () => propertyService.listProjects(),
    [],
  );

  // Auto-select first project if not selected
  React.useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  // Fetch towers for selected project
  const {
    data: towers,
    loading: loadingTowers,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyTower[]>(
    () => (selectedProjectId ? propertyService.listTowers(selectedProjectId) : Promise.resolve([])),
    [selectedProjectId],
  );

  const handleCreate = async () => {
    if (!selectedProjectId) {
      showToast('Please select a project first', 'error');
      return;
    }
    if (!towerName.trim()) {
      showToast('Tower name is required (e.g. Tower A)', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await propertyService.createTower(selectedProjectId, {
        name: towerName.trim(),
        towerNumber: towerNumber.trim() || undefined,
        totalFloors: totalFloors ? Number(totalFloors) : undefined,
        totalUnits: totalUnits ? Number(totalUnits) : undefined,
      });
      showToast('Tower created successfully', 'success');
      setModalOpen(false);
      setTowerName('');
      setTowerNumber('');
      setTotalFloors('');
      setTotalUnits('');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create tower', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTower = (tower: PropertyTower) => {
    Alert.alert(
      'Delete Tower / Wing',
      `Are you sure you want to delete "${tower.name}"?\n\nThis will permanently delete this tower/wing, all its configured floor levels, and associated units.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteTower(tower._id);
              showToast(`Tower "${tower.name}" deleted successfully`, 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete tower', 'error');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Towers & Wings"
        subtitle="Manage blocks, wings and tower structures"
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
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New Tower</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Project Selector Horizontal Pills */}
      {projects && projects.length > 0 && (
        <View style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
          >
            {projects.map((p) => {
              const active = p._id === selectedProjectId;
              return (
                <Pressable
                  key={p._id}
                  onPress={() => setSelectedProjectId(p._id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontSize: 13,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {p.name}
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
        {loadingProjects || loadingTowers ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={100} />
            <Skeleton height={100} />
            <Skeleton height={100} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load towers'} onRetry={reload} />
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            title="No Property Projects Found"
            message="Create a project first before configuring towers."
            actionLabel="Go to Projects"
            onAction={() => router.push('/property/projects')}
          />
        ) : !towers || towers.length === 0 ? (
          <EmptyState
            title="No Towers Added Yet"
            message="Add Tower A, Tower B, or Wings to this project."
            actionLabel="Add Tower"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {towers.map((tower) => (
              <Card key={tower._id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                        {tower.name}
                      </Text>
                      {tower.towerNumber ? (
                        <Badge tone="orange" label={`Wing ${tower.towerNumber}`} />
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                      Node Type: {tower.nodeType || 'Tower'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      onPress={() => router.push(`/property/floors?projectId=${selectedProjectId}&towerId=${tower._id}` as any)}
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
                      <Ionicons name="layers-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Floors</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push(`/property/flats?projectId=${selectedProjectId}&towerId=${tower._id}` as any)}
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
                      <Ionicons name="home-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Flats</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteTower(tower)}
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

                {/* Metrics Grid */}
                <View
                  style={{
                    flexDirection: 'row',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Floors</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {tower.totalFloors ?? '—'}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Total Units</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {tower.totalUnits ?? '—'}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Commercial</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {tower.category === 'commercial' ? 'Yes' : 'Mixed/Resi'}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Tower Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              maxHeight: '85%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Tower / Wing</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <Input
                label="Tower / Wing Name *"
                placeholder="e.g. Tower A or Wing Emerald"
                value={towerName}
                onChangeText={setTowerName}
              />
              <Input
                label="Tower Code / Number"
                placeholder="e.g. A or T-1"
                value={towerNumber}
                onChangeText={setTowerNumber}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Total Floors"
                    placeholder="e.g. 14"
                    keyboardType="number-pad"
                    value={totalFloors}
                    onChangeText={setTotalFloors}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Total Units"
                    placeholder="e.g. 56"
                    keyboardType="number-pad"
                    value={totalUnits}
                    onChangeText={setTotalUnits}
                  />
                </View>
              </View>

              <Button
                label={submitting ? 'Creating...' : 'Create Tower'}
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
