import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  Pressable,
  Linking,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import type { PropertyBooking } from '@/types';

function formatCurrency(amount?: number) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export default function PropertyBookingDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Milestone schedule builder state
  const [milestonesText, setMilestonesText] = useState(
    JSON.stringify(
      [
        { name: 'Booking Token', percentage: 10, dueDate: new Date().toISOString().slice(0, 10) },
        { name: 'On Plinth Level', percentage: 20, dueDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) },
        { name: 'On 4th Slab Casting', percentage: 25, dueDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10) },
        { name: 'On Masonry & Plaster', percentage: 25, dueDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10) },
        { name: 'On Notice of Possession', percentage: 20, dueDate: new Date(Date.now() + 240 * 86400000).toISOString().slice(0, 10) },
      ],
      null,
      2,
    ),
  );

  const {
    data: booking,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyBooking>(
    () => (id ? propertyService.getBooking(id) : Promise.reject(new Error('No booking ID'))),
    [id],
  );

  const handleGenerateBanakhat = async () => {
    if (!id) return;
    setGeneratingDoc(true);
    try {
      const doc = await propertyService.generateBanakhat(id, {
        possessionMonths: 24,
        jurisdiction: 'Ahmedabad / Local Court',
      });
      showToast('Banakhat agreement generated!', 'success');
      if (doc?._id) {
        const url = propertyService.getDocumentPdfUrl(doc._id);
        void Linking.openURL(url);
      }
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to generate Banakhat', 'error');
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handleGenerateDastavej = async () => {
    if (!id) return;
    setGeneratingDoc(true);
    try {
      const doc = await propertyService.generateDastavej(id, {
        subRegistrarOffice: 'Sub-Registrar Zone IV',
        stampDutyAmount: 250000,
        registrationFee: 35000,
      });
      showToast('Dastavej sale deed generated!', 'success');
      if (doc?._id) {
        const url = propertyService.getDocumentPdfUrl(doc._id);
        void Linking.openURL(url);
      }
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to generate Dastavej', 'error');
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!id) return;
    try {
      const parsed = JSON.parse(milestonesText);
      await propertyService.generateSchedule(id, parsed);
      showToast('Payment schedule updated', 'success');
      setScheduleModalOpen(false);
      void reload();
    } catch {
      showToast('Invalid schedule JSON format', 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Booking Details"
        subtitle={booking ? `Unit ${(booking.unitId as any)?.unitNumber || ''} • ${(booking.customerId as any)?.name || ''}` : 'Booking'}
        onBack={() => router.back()}
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={140} />
            <Skeleton height={120} />
            <Skeleton height={220} />
          </View>
        ) : error || !booking ? (
          <ErrorState message={error || 'Booking not found'} onRetry={reload} />
        ) : (
          <View style={{ gap: 16 }}>
            {/* Top Unit & Customer Card */}
            <Card style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                    Unit {(booking.unitId as any)?.unitNumber || 'Unit'}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                    {(booking.projectId as any)?.name || 'Project'} • {(booking.unitId as any)?.bedrooms ? `${(booking.unitId as any).bedrooms} BHK` : 'Property'}
                  </Text>
                </View>
                <Badge
                  tone={booking.status === 'confirmed' ? 'success' : 'neutral'}
                  label={booking.status.toUpperCase()}
                />
              </View>

              <View
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Customer</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                    {(booking.customerId as any)?.name || '—'}
                  </Text>
                </View>

                {(booking.customerId as any)?._id ? (
                  <Pressable
                    onPress={() => router.push(`/property/customer/${(booking.customerId as any)._id}` as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.surfaceAlt,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="person-circle-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Customer 360°</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>

            {/* Commercial Break-up */}
            <Card style={{ padding: 18, gap: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Commercial Summary</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Base Price</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  {formatCurrency(booking.basePrice || booking.totalValue)}
                </Text>
              </View>

              {booking.discountAmount ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: colors.success }}>
                    Discount ({booking.discountReason || 'Approved'})
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.success }}>
                    - {formatCurrency(booking.discountAmount)}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Final Net Amount</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>
                  {formatCurrency(booking.finalPrice || booking.totalValue || booking.bookingAmount)}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Token Advance Paid</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.success }}>
                  {formatCurrency(booking.bookingAmount)}
                </Text>
              </View>
            </Card>

            {/* Legal Documents Generator Actions */}
            <Card style={{ padding: 18, gap: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                Legal Real Estate Deeds
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Generate official legal agreements with RERA clauses, schedule of properties and payment terms.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={generatingDoc ? 'Generating...' : 'Banakhat (Agreement)'}
                    variant="secondary"
                    onPress={handleGenerateBanakhat}
                    disabled={generatingDoc}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={generatingDoc ? 'Generating...' : 'Dastavej (Sale Deed)'}
                    variant="secondary"
                    onPress={handleGenerateDastavej}
                    disabled={generatingDoc}
                  />
                </View>
              </View>
            </Card>

            {/* Installment Payment Milestones */}
            <Card style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  Payment Schedule
                </Text>
                <Pressable onPress={() => setScheduleModalOpen(true)}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    Configure Milestones
                  </Text>
                </Pressable>
              </View>

              {(!booking.paymentSchedule || booking.paymentSchedule.length === 0) ? (
                <EmptyState
                  title="No Milestones Defined"
                  message="Set up construction-linked payment milestones (e.g. Plinth, Slab, Possession)."
                  actionLabel="Configure Schedule"
                  onAction={() => setScheduleModalOpen(true)}
                />
              ) : (
                <View style={{ gap: 10 }}>
                  {booking.paymentSchedule.map((milestone, idx) => (
                    <View
                      key={idx}
                      style={{
                        padding: 12,
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                          {milestone.title || (milestone as any).milestoneName} ({milestone.percentage}%)
                        </Text>
                        <Badge
                          tone={milestone.status === 'paid' ? 'success' : milestone.status === 'overdue' ? 'danger' : 'neutral'}
                          label={milestone.status.toUpperCase()}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          Due: {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString('en-IN') : 'TBD'}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                          {formatCurrency(milestone.amount)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Action Bar */}
            <Button
              label="Record Payment & Issue Receipt"
              onPress={() => router.push(`/property/payments?bookingId=${booking._id}&customerId=${(booking.customerId as any)?._id}` as any)}
            />
          </View>
        )}
      </ScrollView>

      {/* Schedule Configuration Modal */}
      <Modal visible={scheduleModalOpen} transparent animationType="slide" onRequestClose={() => setScheduleModalOpen(false)}>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Payment Milestones Schedule</Text>
              <Pressable onPress={() => setScheduleModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
              Enter milestone schedule in JSON format (Title, Percentage, Due Date):
            </Text>

            <Input
              multiline
              numberOfLines={10}
              value={milestonesText}
              onChangeText={setMilestonesText}
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            />

            <Button
              label="Save & Recalculate Milestones"
              onPress={handleSaveSchedule}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
