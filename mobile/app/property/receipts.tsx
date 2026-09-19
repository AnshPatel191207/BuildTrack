import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable, Linking, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { PropertyPayment } from '@/types';

function formatCurrency(amount?: number) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export default function PropertyReceiptsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const [search, setSearch] = useState('');
  const [generatingReceiptId, setGeneratingReceiptId] = useState<string | null>(null);

  const handleGenerateReceipt = async (paymentId: string) => {
    setGeneratingReceiptId(paymentId);
    try {
      const res = await propertyService.generateReceipt(paymentId);
      showToast(`Official Receipt ${res?.receiptNumber || ''} generated!`, 'success');
      void reload();
      const url = propertyService.getReceiptPdfUrl(paymentId);
      void Linking.openURL(url);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to generate receipt', 'error');
    } finally {
      setGeneratingReceiptId(null);
    }
  };

  const {
    data: payments,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyPayment[]>(
    () => propertyService.listPayments({ status: 'paid' }),
    [],
  );

  const filteredReceipts = (payments || []).filter((p) => {
    if (p.status !== 'paid' && !p.receiptNumber) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const rNo = (p.receiptNumber || p.paymentNumber || '').toLowerCase();
    const custName = ((p.customerId as any)?.name || '').toLowerCase();
    return rNo.includes(q) || custName.includes(q);
  });

  const handleDownload = (paymentId: string) => {
    try {
      const url = propertyService.getReceiptPdfUrl(paymentId);
      void Linking.openURL(url);
    } catch {
      showToast('Could not open receipt PDF', 'error');
    }
  };

  const handleShare = async (receipt: PropertyPayment) => {
    try {
      const url = propertyService.getReceiptPdfUrl(receipt._id);
      await Share.share({
        message: `BuildTrack Payment Receipt #${receipt.receiptNumber || 'Receipt'} for ${formatCurrency(receipt.amount)}. Download link: ${url}`,
        url,
        title: `Payment Receipt ${receipt.receiptNumber || ''}`,
      });
    } catch {
      showToast('Could not share receipt', 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Payment Receipts"
        subtitle="Official builder receipts with QR verification"
        large
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push('/property/payments')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.md,
            }}
          >
            <Ionicons name="receipt-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Issue Receipt</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: 10 }}>
        <Input
          placeholder="Search receipt number (e.g. RCP-2026-000001) or customer..."
          value={search}
          onChangeText={setSearch}
        />
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
          <ErrorState message={error || 'Failed to load receipts'} onRetry={reload} />
        ) : filteredReceipts.length === 0 ? (
          <EmptyState
            title="No Receipts Found"
            message="Payment receipts generated from confirmed bookings will appear here."
            actionLabel="Record Payment"
            onAction={() => router.push('/property/payments')}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {filteredReceipts.map((r) => (
              <Card key={r._id} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                        {r.receiptNumber || r.paymentNumber || 'OFFICIAL RECEIPT'}
                      </Text>
                      <Badge tone="orange" label={(r.mode || r.method || 'PAYMENT').toUpperCase()} />
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                      👤 {(r.customerId as any)?.name || 'Customer'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>
                      Date: {new Date(r.paidDate || r.dueDate || new Date()).toLocaleDateString('en-IN')}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.success }}>
                    {formatCurrency(r.amount)}
                  </Text>
                </View>

                {/* QR Code & Verification Status */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="qr-code-outline" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    Tamper-proof digitally signed receipt with QR verification
                  </Text>
                </View>

                {/* Actions */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <Pressable
                    onPress={() => handleGenerateReceipt(r._id)}
                    disabled={generatingReceiptId === r._id}
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
                    <Ionicons name="receipt-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                      {generatingReceiptId === r._id
                        ? 'Generating...'
                        : r.receiptNumber
                          ? 'Regenerate'
                          : 'Generate Receipt'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => void handleShare(r)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.surfaceAlt,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="share-social-outline" size={14} color={colors.text} style={{ marginRight: 4 }} />
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Share</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDownload(r._id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radius.sm,
                    }}
                  >
                    <Ionicons name="download-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>PDF Receipt</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
