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
  const [scheduleMode, setScheduleMode] = useState<'clp' | 'emi'>('clp');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Construction-linked plan (CLP) stages state
  interface StageItem {
    id: string;
    name: string;
    percentage: string;
    dueDate: string;
  }

  const defaultStages: StageItem[] = [
    { id: '1', name: 'Booking Advance / Token', percentage: '10', dueDate: new Date().toISOString().slice(0, 10) },
    { id: '2', name: 'On Plinth Level', percentage: '20', dueDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) },
    { id: '3', name: 'On 4th Slab Casting', percentage: '25', dueDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10) },
    { id: '4', name: 'On Brickwork & Plaster', percentage: '25', dueDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10) },
    { id: '5', name: 'On Notice of Possession', percentage: '20', dueDate: new Date(Date.now() + 240 * 86400000).toISOString().slice(0, 10) },
  ];

  const [stages, setStages] = useState<StageItem[]>(defaultStages);

  // EMI Installment plan state
  const [emiCount, setEmiCount] = useState('6');
  const [emiFrequency, setEmiFrequency] = useState<1 | 3>(1);
  const [emiStartDate, setEmiStartDate] = useState(new Date().toISOString().slice(0, 10));

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

  const dealValue = booking ? (booking.finalPrice || booking.totalValue || booking.bookingAmount || 0) : 0;
  const tokenAdvance = booking?.bookingAmount || 0;
  const balanceToSchedule = Math.max(dealValue - tokenAdvance, 0);

  const totalStagePercentage = Math.round(stages.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0) * 10) / 10;
  const isStagesValid = Math.abs(totalStagePercentage - 100) < 0.1;

  const handleAddStage = () => {
    const remainingPct = Math.max(100 - totalStagePercentage, 0);
    const lastDate =
      stages.length > 0 && stages[stages.length - 1].dueDate
        ? new Date(stages[stages.length - 1].dueDate).getTime()
        : Date.now();
    const nextDate = new Date(lastDate + 60 * 86400000).toISOString().slice(0, 10);
    setStages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: `Stage ${prev.length + 1}`,
        percentage: remainingPct > 0 ? String(remainingPct) : '10',
        dueDate: nextDate,
      },
    ]);
  };

  const handleRemoveStage = (idToRemove: string) => {
    if (stages.length <= 1) {
      showToast('Schedule must contain at least one milestone', 'error');
      return;
    }
    setStages((prev) => prev.filter((s) => s.id !== idToRemove));
  };

  const handleUpdateStage = (idToUpdate: string, field: 'name' | 'percentage' | 'dueDate', value: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === idToUpdate ? { ...s, [field]: value } : s)),
    );
  };

  const handleApplyPreset = (preset: '5stage' | '3stage') => {
    if (preset === '5stage') {
      setStages(defaultStages);
    } else {
      setStages([
        { id: '1', name: 'Booking Token', percentage: '20', dueDate: new Date().toISOString().slice(0, 10) },
        { id: '2', name: 'Structure Completed', percentage: '50', dueDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10) },
        { id: '3', name: 'Notice of Possession', percentage: '30', dueDate: new Date(Date.now() + 240 * 86400000).toISOString().slice(0, 10) },
      ]);
    }
  };

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
    setSavingSchedule(true);
    try {
      if (scheduleMode === 'clp') {
        if (!isStagesValid) {
          showToast(`Milestones sum to ${totalStagePercentage}%. They must equal 100%.`, 'error');
          setSavingSchedule(false);
          return;
        }

        const milestonesPayload = stages.map((s) => {
          const pct = parseFloat(s.percentage) || 0;
          return {
            name: s.name.trim() || 'Construction Milestone',
            percentage: pct,
            amount: Math.round((dealValue * pct) / 100),
            dueDate: s.dueDate ? s.dueDate.trim() : new Date().toISOString().slice(0, 10),
          };
        });

        await propertyService.generateSchedule(id, milestonesPayload);
        showToast('Construction milestone plan activated!', 'success');
      } else {
        const count = parseInt(emiCount, 10);
        if (isNaN(count) || count < 1 || count > 60) {
          showToast('Enter valid installment count (1-60)', 'error');
          setSavingSchedule(false);
          return;
        }

        await propertyService.generateSchedule(id, {
          installments: count,
          frequencyMonths: emiFrequency,
          startDate: emiStartDate || new Date().toISOString().slice(0, 10),
        });
        showToast(`Equal installment plan (${count} payments) activated!`, 'success');
      }

      setScheduleModalOpen(false);
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to activate payment plan', 'error');
    } finally {
      setSavingSchedule(false);
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
                  label={(booking.status || 'PENDING').toUpperCase()}
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
                          label={(milestone.status || 'PENDING').toUpperCase()}
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

      {/* Interactive Schedule Configuration Modal */}
      <Modal visible={scheduleModalOpen} transparent animationType="slide" onRequestClose={() => setScheduleModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              maxHeight: '92%',
            }}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Payment Plan Builder</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Net Deal: {formatCurrency(dealValue)} • Unit {(booking?.unitId as any)?.unitNumber || ''}
                </Text>
              </View>
              <Pressable onPress={() => setScheduleModalOpen(false)} hitSlop={10}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Mode Switcher Tabs */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                padding: 4,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pressable
                onPress={() => setScheduleMode('clp')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: scheduleMode === 'clp' ? colors.primary : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: scheduleMode === 'clp' ? '#fff' : colors.textMuted }}>
                  🏗️ Construction Stages (CLP)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setScheduleMode('emi')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: scheduleMode === 'emi' ? colors.primary : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: scheduleMode === 'emi' ? '#fff' : colors.textMuted }}>
                  📅 Equal Installments (EMI)
                </Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {scheduleMode === 'clp' ? (
                /* ── CONSTRUCTION LINKED MILESTONES ── */
                <View style={{ gap: 12 }}>
                  {/* Status & Validation Bar */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: colors.surface,
                      padding: 12,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: isStagesValid ? colors.success : colors.border,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Allocation Progress</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                        {totalStagePercentage}% Total
                      </Text>
                    </View>
                    <Badge
                      tone={isStagesValid ? 'success' : totalStagePercentage > 100 ? 'danger' : 'orange'}
                      label={isStagesValid ? '100% Valid' : totalStagePercentage > 100 ? `+${(totalStagePercentage - 100).toFixed(0)}% Over` : `${(100 - totalStagePercentage).toFixed(0)}% Needed`}
                    />
                  </View>

                  {/* Preset Shortcuts */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>Presets:</Text>
                    <Pressable
                      onPress={() => handleApplyPreset('5stage')}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>Standard 5-Stage</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleApplyPreset('3stage')}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>3-Stage Fast</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleAddStage}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        backgroundColor: colors.primaryMuted,
                        borderRadius: radius.sm,
                        marginLeft: 'auto',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>+ Add Stage</Text>
                    </Pressable>
                  </View>

                  {/* Milestone Stages List */}
                  {stages.map((stage, idx) => {
                    const pctNum = parseFloat(stage.percentage) || 0;
                    const stageAmt = Math.round((dealValue * pctNum) / 100);
                    return (
                      <View
                        key={stage.id}
                        style={{
                          backgroundColor: colors.surface,
                          borderRadius: radius.md,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          gap: 10,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: colors.primaryMuted,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>{idx + 1}</Text>
                            </View>
                            <Input
                              placeholder="Stage Name"
                              value={stage.name}
                              onChangeText={(val) => handleUpdateStage(stage.id, 'name', val)}
                              style={{ flex: 1, height: 38, fontSize: 13, fontWeight: '600' }}
                            />
                          </View>
                          {stages.length > 1 ? (
                            <Pressable onPress={() => handleRemoveStage(stage.id)} hitSlop={8}>
                              <Ionicons name="trash-outline" size={18} color={colors.danger} />
                            </Pressable>
                          ) : null}
                        </View>

                        {/* Quick Name Chips */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {['Plinth', '1st Slab', '4th Slab', 'Top Slab', 'Plaster', 'Possession'].map((nameTag) => (
                            <Pressable
                              key={nameTag}
                              onPress={() => handleUpdateStage(stage.id, 'name', `On ${nameTag}`)}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                backgroundColor: colors.surfaceAlt,
                                borderRadius: radius.sm,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              <Text style={{ fontSize: 10, color: colors.textMuted }}>{nameTag}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>

                        {/* Percentage & Due Date Row */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                              Percent (%): <Text style={{ fontWeight: '700', color: colors.primary }}>{formatCurrency(stageAmt)}</Text>
                            </Text>
                            <Input
                              placeholder="10"
                              value={stage.percentage}
                              onChangeText={(val) => handleUpdateStage(stage.id, 'percentage', val)}
                              keyboardType="decimal-pad"
                              style={{ height: 38, fontSize: 13 }}
                            />
                          </View>
                          <View style={{ flex: 1.2 }}>
                            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Target Due Date</Text>
                            <Input
                              placeholder="YYYY-MM-DD"
                              value={stage.dueDate}
                              onChangeText={(val) => handleUpdateStage(stage.id, 'dueDate', val)}
                              style={{ height: 38, fontSize: 13 }}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* ── EQUAL INSTALLMENTS (EMI) ── */
                <View style={{ gap: 14 }}>
                  <Card style={{ padding: 14, gap: 8, backgroundColor: colors.surface }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>Total Deal Value</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{formatCurrency(dealValue)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: colors.success }}>Token Paid</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>- {formatCurrency(tokenAdvance)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Balance to Install</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{formatCurrency(balanceToSchedule)}</Text>
                    </View>
                  </Card>

                  {/* Installment count selector */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                      Number of Installments:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {['3', '6', '12', '18', '24', '36'].map((cnt) => {
                        const active = emiCount === cnt;
                        return (
                          <Pressable
                            key={cnt}
                            onPress={() => setEmiCount(cnt)}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 7,
                              borderRadius: radius.md,
                              backgroundColor: active ? colors.primary : colors.surfaceAlt,
                              borderWidth: 1,
                              borderColor: active ? colors.primary : colors.border,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.text }}>
                              {cnt} Mos
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Input
                      label="Custom Installment Count (1-60)"
                      placeholder="e.g. 10"
                      keyboardType="number-pad"
                      value={emiCount}
                      onChangeText={setEmiCount}
                    />
                  </View>

                  {/* Frequency */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                      Installment Cadence:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        onPress={() => setEmiFrequency(1)}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: radius.md,
                          backgroundColor: emiFrequency === 1 ? colors.primaryMuted : colors.surface,
                          borderWidth: 1,
                          borderColor: emiFrequency === 1 ? colors.primary : colors.border,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: emiFrequency === 1 ? colors.primary : colors.text }}>
                          Monthly (1 Month)
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEmiFrequency(3)}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: radius.md,
                          backgroundColor: emiFrequency === 3 ? colors.primaryMuted : colors.surface,
                          borderWidth: 1,
                          borderColor: emiFrequency === 3 ? colors.primary : colors.border,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: emiFrequency === 3 ? colors.primary : colors.text }}>
                          Quarterly (3 Months)
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Start Date */}
                  <Input
                    label="First Installment Due Date"
                    placeholder="YYYY-MM-DD"
                    value={emiStartDate}
                    onChangeText={setEmiStartDate}
                  />

                  {/* Per Installment Preview Banner */}
                  <View
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      padding: 14,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Computed Monthly Installment</Text>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 4 }}>
                      {formatCurrency(balanceToSchedule > 0 && Number(emiCount) > 0 ? Math.round(balanceToSchedule / Number(emiCount)) : 0)}
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}> / installment</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>
                      Across {emiCount || 1} installments, starting {emiStartDate}
                    </Text>
                  </View>
                </View>
              )}

              {/* Activate Button */}
              <View style={{ marginTop: 18 }}>
                <Button
                  label={savingSchedule ? 'Activating Plan...' : 'Activate Payment Plan'}
                  onPress={handleSaveSchedule}
                  disabled={savingSchedule || (scheduleMode === 'clp' && !isStagesValid)}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
