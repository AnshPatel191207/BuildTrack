import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable, Modal } from 'react-native';
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
import type { PropertyProject } from '@/types';

export default function PropertyProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [builderName, setBuilderName] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  const [totalTowers, setTotalTowers] = useState('');
  const [totalUnits, setTotalUnits] = useState('');

  const { data, loading, error, refreshing, refresh, reload } = useResource<PropertyProject[]>(
    () => propertyService.listProjects({ search: search || undefined }),
    [search],
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Project name is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await propertyService.createProject({
        name: name.trim(),
        location: location.trim() || undefined,
        builderName: builderName.trim() || undefined,
        reraNumber: reraNumber.trim() || undefined,
        totalTowers: totalTowers ? Number(totalTowers) : undefined,
        totalUnits: totalUnits ? Number(totalUnits) : undefined,
      });
      showToast('Property project created', 'success');
      setModalOpen(false);
      setName('');
      setLocation('');
      setBuilderName('');
      setReraNumber('');
      setTotalTowers('');
      setTotalUnits('');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create project', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Property Projects"
        subtitle="RERA registered real estate developments"
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
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New Project</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        <Input
          placeholder="Search projects, RERA, builder..."
          value={search}
          onChangeText={setSearch}
        />

        {loading && !data ? (
          <View style={{ marginTop: spacing.md }}>
            <Skeleton height={130} style={{ marginBottom: 12 }} />
            <Skeleton height={130} />
          </View>
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No Property Projects"
            message="Create your first property project to manage towers, flats, and shops."
            icon="business-outline"
            actionLabel="Create Project"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            {data.map((p) => (
              <Card
                key={p._id}
                style={{ marginBottom: 12, padding: 14 }}
                onPress={() => router.push(`/property/towers?projectId=${p._id}` as never)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{p.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 2 }}>
                      {p.builderName ? `By ${p.builderName}` : p.projectCode} • {p.location || 'Location not specified'}
                    </Text>
                  </View>
                  <Badge
                    label={(p.status || 'active').toUpperCase()}
                    tone={p.status === 'active' ? 'success' : 'neutral'}
                  />
                </View>

                {p.reraNumber ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Ionicons name="shield-checkmark" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '600' }}>
                      RERA: {p.reraNumber}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    backgroundColor: colors.surfaceAlt,
                    padding: 8,
                    borderRadius: radius.md,
                    marginTop: 10,
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Towers: <Text style={{ color: colors.text, fontWeight: '700' }}>{p.towersCount || 0}</Text>
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Available: <Text style={{ color: colors.success, fontWeight: '700' }}>{p.inventoryStats?.available || 0}</Text>
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Booked: <Text style={{ color: colors.primary, fontWeight: '700' }}>{p.inventoryStats?.booked || 0}</Text>
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Sold: <Text style={{ color: colors.navy, fontWeight: '700' }}>{p.inventoryStats?.sold || 0}</Text>
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Project Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: spacing.lg,
              maxHeight: '85%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>New Property Project</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textFaint} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <Input label="Project Name *" placeholder="e.g. Orchid Heights" value={name} onChangeText={setName} />
              <Input label="Location" placeholder="e.g. SG Highway, Ahmedabad" value={location} onChangeText={setLocation} />
              <Input label="Builder / Developer Name" placeholder="e.g. Orchid Infracon LLP" value={builderName} onChangeText={setBuilderName} />
              <Input label="RERA Registration Number" placeholder="e.g. PR/GJ/AHMEDABAD/..." value={reraNumber} onChangeText={setReraNumber} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="Total Towers" placeholder="e.g. 4" keyboardType="numeric" value={totalTowers} onChangeText={setTotalTowers} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Total Units" placeholder="e.g. 240" keyboardType="numeric" value={totalUnits} onChangeText={setTotalUnits} />
                </View>
              </View>

              <Button
                label={submitting ? 'Creating...' : 'Create Property Project'}
                onPress={() => void handleCreate()}
                loading={submitting}
                style={{ marginTop: spacing.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
