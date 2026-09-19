import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View, Pressable, Linking, Modal } from 'react-native';
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
import type { PropertyBooking, PropertyDocumentItem } from '@/types';

export default function PropertyBanakhatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [possessionMonths, setPossessionMonths] = useState('24');
  const [jurisdiction, setJurisdiction] = useState('Local City Civil Court / RERA Authority');
  const [specialConditions, setSpecialConditions] = useState('');

  // Fetch confirmed and sold bookings
  const { data: bookings } = useResource<PropertyBooking[]>(
    () => propertyService.listBookings({ status: 'confirmed,sold' as any }),
    [],
  );

  // Fetch Banakhat documents
  const {
    data: documents,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyDocumentItem[]>(
    () => propertyService.listDocuments({ documentType: 'banakhat' }),
    [],
  );

  const handleGenerate = async () => {
    if (!selectedBookingId) {
      showToast('Select a confirmed booking', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const doc = await propertyService.generateBanakhat(selectedBookingId, {
        possessionMonths: Number(possessionMonths) || 24,
        jurisdiction: jurisdiction.trim() || undefined,
        specialConditions: specialConditions.trim() || undefined,
      });

      showToast('Banakhat agreement generated successfully!', 'success');
      setModalOpen(false);
      setSelectedBookingId('');
      setSpecialConditions('');
      void reload();

      if (doc?._id) {
        const url = propertyService.getDocumentPdfUrl(doc._id);
        void Linking.openURL(url);
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to generate Banakhat', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = (docId: string) => {
    try {
      const url = propertyService.getDocumentPdfUrl(docId);
      void Linking.openURL(url);
    } catch {
      showToast('Could not open Banakhat PDF', 'error');
    }
  };

  const handleDeleteDocument = (doc: PropertyDocumentItem) => {
    Alert.alert(
      'Delete Agreement',
      `Are you sure you want to delete Banakhat document #${doc.documentNumber || doc._id}? This will remove the document file and unlink it from the booking.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteDocument(doc._id);
              showToast('Agreement deleted', 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete agreement', 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Banakhat (Agreement)"
        subtitle="RERA compliant Agreement for Sale generator"
        large
        onBack={() => router.back()}
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
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Generate</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

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
          <ErrorState message={error || 'Failed to load agreements'} onRetry={reload} />
        ) : !documents || documents.length === 0 ? (
          <EmptyState
            title="No Banakhat Agreements"
            message="Generate a legal Agreement for Sale (Banakhat) for any confirmed booking."
            actionLabel="Generate Banakhat"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {documents.map((doc) => (
              <Card key={doc._id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="document-text" size={18} color={colors.primary} />
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                        {doc.title || 'Agreement for Sale'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                      Doc #{doc.documentNumber} • {new Date(doc.createdAt).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <Badge
                    tone={doc.status === 'registered' ? 'success' : 'neutral'}
                    label={(doc.status || 'generated').toUpperCase()}
                  />
                </View>

                {/* Terms Summary */}
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
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Type</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                      Banakhat
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Clauses</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                      RERA Schedule C
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      onPress={() => handleDeleteDocument(doc)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.dangerSoft,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: radius.sm,
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.danger} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDownload(doc._id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.primary,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: radius.sm,
                      }}
                    >
                      <Ionicons name="download-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>PDF</Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Generate Modal */}
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Generate Banakhat</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                  Select Confirmed Booking *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {bookings?.map((b) => {
                    const active = b._id === selectedBookingId;
                    return (
                      <Pressable
                        key={b._id}
                        onPress={() => setSelectedBookingId(b._id)}
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
                          Unit {(b.unitId as any)?.unitNumber || 'Unit'} • {(b.customerId as any)?.name || 'Buyer'}{b.status ? ` [${b.status.toUpperCase()}]` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Input
                label="Possession Commitment (Months) *"
                placeholder="e.g. 24"
                keyboardType="number-pad"
                value={possessionMonths}
                onChangeText={setPossessionMonths}
              />

              <Input
                label="Legal Jurisdiction *"
                placeholder="e.g. City Civil Court / RERA Authority"
                value={jurisdiction}
                onChangeText={setJurisdiction}
              />

              <Input
                label="Special Stipulations / Clauses"
                placeholder="Additional specifications or agreed terms"
                value={specialConditions}
                onChangeText={setSpecialConditions}
                multiline
                numberOfLines={3}
              />

              <Button
                label={submitting ? 'Generating Agreement...' : 'Generate Official Banakhat PDF'}
                onPress={handleGenerate}
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
