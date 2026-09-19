import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Pressable,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { Customer360Response } from '@/types';

function formatCurrency(amount?: number) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export default function Customer360Screen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const [activeTab, setActiveTab] = useState<'bookings' | 'receipts' | 'documents' | 'kyc'>('bookings');

  const { data, loading, error, refreshing, refresh, reload } = useResource<Customer360Response>(
    () => (id ? propertyService.getCustomer360(id) : Promise.reject(new Error('No customer ID'))),
    [id],
  );

  const customer = data?.customer;
  const financials = data?.financials || { totalBilled: 0, totalPaid: 0, balanceDue: 0 };
  const bookings = data?.bookings || [];
  const receipts = data?.receipts || [];
  const documents = data?.documents || [];

  const handleCall = () => {
    if (customer?.phone) Linking.openURL(`tel:${customer.phone}`);
  };

  const handleWhatsApp = () => {
    if (customer?.phone) {
      const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
      const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      Linking.openURL(`https://wa.me/${waNumber}?text=Hello ${encodeURIComponent(customer.name)}, regarding your property booking at BuildTrack.`);
    }
  };

  const handleDownloadReceipt = (receiptId: string) => {
    try {
      const downloadUrl = propertyService.getReceiptPdfUrl(receiptId);
      void Linking.openURL(downloadUrl);
    } catch {
      showToast('Could not open receipt PDF', 'error');
    }
  };

  const handleDownloadDocument = (docId: string) => {
    try {
      const downloadUrl = propertyService.getDocumentPdfUrl(docId);
      void Linking.openURL(downloadUrl);
    } catch {
      showToast('Could not open document PDF', 'error');
    }
  };

  const handleDeleteReceipt = (paymentId: string, receiptNumber?: string | null) => {
    Alert.alert(
      'Delete Receipt',
      `Are you sure you want to delete receipt #${receiptNumber || paymentId}? This will remove the receipt PDF and reset receipt status on the payment record.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteReceipt(paymentId);
              showToast('Receipt deleted successfully', 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete receipt', 'error');
            }
          },
        },
      ]
    );
  };

  const handleDeleteDocument = (docId: string, docNumber?: string | null) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete document #${docNumber || docId}? This will delete the legal document record and file.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteDocument(docId);
              showToast('Document deleted successfully', 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete document', 'error');
            }
          },
        },
      ]
    );
  };

  const handleDeleteCustomer = () => {
    if (!customer) return;
    Alert.alert(
      'Delete Customer Profile',
      `Are you sure you want to delete customer "${customer.name}"?\n\nAny units currently booked or purchased by this buyer will be released back to available inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Customer',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteCustomer(customer._id);
              showToast('Customer deleted and assigned units released to available', 'success');
              router.back();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete customer', 'error');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Customer 360° Profile"
        subtitle={customer?.name || 'Buyer Overview'}
        onBack={() => router.back()}
        right={
          customer ? (
            <Pressable
              onPress={handleDeleteCustomer}
              hitSlop={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.danger,
              }}
            >
              <Ionicons name="trash-outline" size={15} color={colors.danger} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
            </Pressable>
          ) : null
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
          <View style={{ gap: 14 }}>
            <Skeleton height={140} />
            <Skeleton height={100} />
            <Skeleton height={200} />
          </View>
        ) : error || !customer ? (
          <ErrorState message={error || 'Failed to load customer profile'} onRetry={reload} />
        ) : (
          <View style={{ gap: 16 }}>
            {/* Customer Hero Card */}
            <Card style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>
                    {(customer.name || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>
                      {customer.name}
                    </Text>
                    <Badge
                      tone={customer.stage === 'booked' ? 'success' : 'info'}
                      label={(customer.stage || customer.journeyStage || 'ACTIVE').toUpperCase()}
                    />
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                    📞 {customer.phone}
                  </Text>
                  {customer.email ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      ✉️ {customer.email}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Quick Contact Actions */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  marginTop: 16,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Pressable
                  onPress={handleCall}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surfaceAlt,
                    paddingVertical: 9,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="call" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Call</Text>
                </Pressable>

                <Pressable
                  onPress={handleWhatsApp}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#25D36620',
                    paddingVertical: 9,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: '#25D36650',
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#25D366' }}>WhatsApp</Text>
                </Pressable>
              </View>
            </Card>

            {/* Financials Cockpit */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Card style={{ flex: 1, padding: 14, backgroundColor: colors.surface }}>
                <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase', fontWeight: '700' }}>
                  Total Agreed
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 }}>
                  {formatCurrency(financials.totalBilled)}
                </Text>
              </Card>

              <Card style={{ flex: 1, padding: 14, backgroundColor: colors.surface }}>
                <Text style={{ fontSize: 11, color: colors.success, textTransform: 'uppercase', fontWeight: '700' }}>
                  Collected
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.success, marginTop: 4 }}>
                  {formatCurrency(financials.totalPaid)}
                </Text>
              </Card>

              <Card style={{ flex: 1, padding: 14, backgroundColor: colors.surface }}>
                <Text style={{ fontSize: 11, color: colors.danger, textTransform: 'uppercase', fontWeight: '700' }}>
                  Balance Due
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.danger, marginTop: 4 }}>
                  {formatCurrency(financials.balanceDue)}
                </Text>
              </Card>
            </View>

            {/* Tab Navigation */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: 4,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {(
                [
                  { id: 'bookings', label: `Units (${bookings.length})`, icon: 'home-outline' },
                  { id: 'receipts', label: `Receipts (${receipts.length})`, icon: 'receipt-outline' },
                  { id: 'documents', label: `Legal (${documents.length})`, icon: 'document-text-outline' },
                  { id: 'kyc', label: 'KYC & Info', icon: 'shield-checkmark-outline' },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: 'center',
                      borderRadius: radius.sm,
                      backgroundColor: active ? colors.primary : 'transparent',
                    }}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={14}
                      color={active ? '#fff' : colors.textMuted}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: active ? '700' : '500',
                        color: active ? '#fff' : colors.textMuted,
                        marginTop: 2,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Tab 1: Bookings */}
            {activeTab === 'bookings' && (
              <View style={{ gap: 12 }}>
                {bookings.length === 0 ? (
                  <EmptyState
                    title="No Booked Units"
                    message="This customer does not have any active unit bookings."
                    actionLabel="Create Booking"
                    onAction={() => router.push(`/property/bookings?customerId=${customer._id}` as any)}
                  />
                ) : (
                  bookings.map((b) => (
                    <Card key={b._id} style={{ padding: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                            Unit {(b.unitId as any)?.unitNumber || 'Booked Unit'}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                            {(b.projectId as any)?.name || 'Project'}
                          </Text>
                        </View>
                        <Badge
                          tone={b.status === 'confirmed' ? 'success' : 'warning'}
                          label={(b.status || 'pending').toUpperCase()}
                        />
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: 12,
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View>
                          <Text style={{ fontSize: 11, color: colors.textFaint }}>Booking Date</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                            {new Date(b.bookingDate).toLocaleDateString('en-IN')}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 11, color: colors.textFaint }}>Agreed Price</Text>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                            {formatCurrency(b.finalPrice || b.totalValue || b.bookingAmount)}
                          </Text>
                        </View>
                      </View>

                      <View style={{ marginTop: 12 }}>
                        <Button
                          label="View Booking & Milestones"
                          variant="secondary"
                          size="sm"
                          onPress={() => router.push(`/property/booking/${b._id}` as any)}
                        />
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* Tab 2: Receipts */}
            {activeTab === 'receipts' && (
              <View style={{ gap: 12 }}>
                {receipts.length === 0 ? (
                  <EmptyState
                    title="No Receipts Issued"
                    message="No payment receipts have been generated for this customer."
                    actionLabel="Record Payment"
                    onAction={() => router.push(`/property/payments?customerId=${customer._id}` as any)}
                  />
                ) : (
                  receipts.map((r) => (
                    <Card key={r._id} style={{ padding: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                            {r.receiptNumber || 'RCP-RECEIPT'}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                            {new Date(r.paidDate || r.dueDate || new Date()).toLocaleDateString('en-IN')} • Mode: {(r.method || r.mode || 'PAYMENT').toUpperCase()}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.success }}>
                          {formatCurrency(r.amount)}
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 12,
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Pressable
                          onPress={() => handleDeleteReceipt(r._id, r.receiptNumber)}
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
                          onPress={() => handleDownloadReceipt(r._id)}
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
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* Tab 3: Legal Documents */}
            {activeTab === 'documents' && (
              <View style={{ gap: 12 }}>
                {documents.length === 0 ? (
                  <EmptyState
                    title="No Legal Documents"
                    message="Banakhat (Agreement for Sale) and Dastavej (Sale Deed) can be generated from the booking."
                  />
                ) : (
                  documents.map((doc) => (
                    <Card key={doc._id} style={{ padding: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="document-attach" size={18} color={colors.primary} />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                              {doc.title || (doc.documentType || 'DOCUMENT').toUpperCase()}
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

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 12,
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Pressable
                          onPress={() => handleDeleteDocument(doc._id, doc.documentNumber)}
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
                          onPress={() => handleDownloadDocument(doc._id)}
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
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* Tab 4: KYC & Info */}
            {activeTab === 'kyc' && (
              <Card style={{ padding: 18, gap: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  Identity & KYC Records
                </Text>

                <View style={{ gap: 10 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>PAN Card</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                      {customer.pan || customer.panNumber || 'Not Provided'}
                    </Text>
                  </View>

                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Aadhaar Number</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                      {customer.aadhaar || customer.aadhaarNumber || 'Not Provided'}
                    </Text>
                  </View>

                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Permanent Address</Text>
                    <Text style={{ fontSize: 14, color: colors.text, marginTop: 2, lineHeight: 20 }}>
                      {customer.address || 'Address not recorded'}
                    </Text>
                  </View>

                  {customer.nominee ? (
                    <View style={{ paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Nominee Information</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                        {customer.nominee.name} ({customer.nominee.relation || 'Relation N/A'})
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            )}

            {/* Destructive Action */}
            <View style={{ marginTop: 16 }}>
              <Button
                label="Delete Customer Profile & Release Units"
                variant="danger"
                onPress={handleDeleteCustomer}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
