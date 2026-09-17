import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '@/components/ui/Toast';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import type { PropertyDashboardStats } from '@/types';
import { formatCompactINR, formatINR } from '@/lib/format';
import { ProjectSwitcher } from '@/components/property/ProjectSwitcher';

export default function PropertyDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const fetchStats = useCallback(async () => {
    return await propertyService.getDashboardStats();
  }, []);

  const { data, loading, error, refreshing, refresh } = useResource<PropertyDashboardStats>(
    fetchStats,
    [],
  );

  const inventory = data?.inventory;
  const collections = data?.collections;
  const totalUnits = inventory?.totalUnits || 0;
  const availableUnits = inventory?.availableUnits || 0;
  const bookedUnits = inventory?.bookedUnits || 0;
  const soldUnits = inventory?.soldUnits || 0;

  const occupancyRate = totalUnits > 0 ? Math.round(((bookedUnits + soldUnits) / totalUnits) * 100) : 0;

  const [seeding, setSeeding] = useState(false);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await propertyService.seedDemoData();
      showToast('Dummy property ERP data seeded successfully!', 'success');
      void refresh();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to seed demo data', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Property ERP"
        subtitle="Real estate inventory & sales cockpit"
        large
        right={
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable
              onPress={handleSeedDemo}
              disabled={seeding}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: radius.md,
              }}
            >
              <Ionicons name="sparkles" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
                {seeding ? 'Seeding...' : 'Seed Data'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/property/import' as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primaryMuted,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: radius.md,
              }}
            >
              <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Import</Text>
            </Pressable>
          </View>
        }
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        <View style={{ marginTop: spacing.md, marginBottom: 4 }}>
          <ProjectSwitcher onProjectChange={() => void refresh()} />
        </View>

        {loading && !data ? (
          <View style={{ marginTop: spacing.md }}>
            <Skeleton height={120} style={{ marginBottom: 12 }} />
            <Skeleton height={180} />
          </View>
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => void refresh()} />
        ) : (
          <>
            {/* Occupancy & Inventory Banner */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                marginTop: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Unit Inventory Overview</Text>
                <Badge label={`${occupancyRate}% Committed`} tone={occupancyRate > 75 ? 'success' : 'orange'} />
              </View>

              <ProgressBar fraction={occupancyRate / 100} tone="primary" height={8} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: colors.textFaint, fontSize: 11, textTransform: 'uppercase' }}>Total Units</Text>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{totalUnits}</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: colors.success, fontSize: 11, textTransform: 'uppercase' }}>Available</Text>
                  <Text style={{ color: colors.success, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{availableUnits}</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: colors.primary, fontSize: 11, textTransform: 'uppercase' }}>Booked</Text>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{bookedUnits}</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: colors.navy, fontSize: 11, textTransform: 'uppercase' }}>Sold</Text>
                  <Text style={{ color: colors.navy, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{soldUnits}</Text>
                </View>
              </View>
            </View>

            {/* Financial Performance KPI Cards */}
            <Text
              style={{
                color: colors.textFaint,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginTop: spacing.lg,
                marginBottom: spacing.xs,
              }}
            >
              Collections & Receivables
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <MetricCard
                  label="Today's Collection"
                  value={formatINR(collections?.today || 0)}
                  sublabel={`${collections?.todayCount || 0} receipt(s)`}
                  icon="cash-outline"
                  tone="success"
                />
              </View>
              <View style={{ flex: 1 }}>
                <MetricCard
                  label="Monthly Inflow"
                  value={formatCompactINR(collections?.monthly || 0)}
                  sublabel={`${collections?.monthlyCount || 0} collections`}
                  icon="trending-up-outline"
                  tone="primary"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <MetricCard
                  label="Pending Installments"
                  value={formatCompactINR(collections?.pending || 0)}
                  sublabel={`${collections?.pendingCount || 0} scheduled`}
                  icon="time-outline"
                  tone="warning"
                />
              </View>
              <View style={{ flex: 1 }}>
                <MetricCard
                  label="Overdue Dues"
                  value={formatCompactINR(collections?.overdue || 0)}
                  sublabel={`${collections?.overdueCount || 0} overdue`}
                  icon="alert-circle-outline"
                  tone={collections?.overdue && collections.overdue > 0 ? 'danger' : 'default'}
                />
              </View>
            </View>

            {/* Quick Navigation Action Grid */}
            <Text
              style={{
                color: colors.textFaint,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginTop: spacing.xl,
                marginBottom: spacing.xs,
              }}
            >
              Property Modules
            </Text>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              {[
                { label: 'Projects & RERA', sub: 'Real estate schemes & builders', icon: 'business-outline', route: '/property/projects' },
                { label: 'Towers & Floors', sub: 'Wings, blocks & floor layouts', icon: 'layers-outline', route: '/property/towers' },
                { label: 'Flats Inventory', sub: 'Residential inventory & pricing', icon: 'home-outline', route: '/property/flats' },
                { label: 'Commercial Shops', sub: 'Retail spaces, rates & status', icon: 'storefront-outline', route: '/property/shops' },
                { label: 'Customer 360°', sub: 'Buyers, KYC, documents & ledger', icon: 'people-outline', route: '/property/customers' },
                { label: 'Bookings & Sales', sub: 'Unit allotment & schedules', icon: 'bookmark-outline', route: '/property/bookings' },
                { label: 'Payments & Receipts', sub: 'Instant RCP-YYYY-* PDF generator', icon: 'receipt-outline', route: '/property/receipts' },
                { label: 'Banakhat Generator', sub: 'Agreement for Sale generation', icon: 'document-text-outline', route: '/property/banakhat' },
                { label: 'Dastavej (Sale Deed)', sub: 'Conveyance deeds & registration', icon: 'ribbon-outline', route: '/property/dastavej' },
                { label: 'Property Reports', sub: 'Ledgers, inventory & Excel export', icon: 'bar-chart-outline', route: '/property/reports' },
              ].map((item, idx) => (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 13,
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: colors.primaryMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={item.icon as never} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '700' }}>{item.label}</Text>
                    <Text style={{ color: colors.textFaint, fontSize: 12 }}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>

            {/* Recent Bookings List */}
            {data?.recentBookings && data.recentBookings.length > 0 ? (
              <View style={{ marginTop: spacing.xl }}>
                <Text
                  style={{
                    color: colors.textFaint,
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginBottom: spacing.xs,
                  }}
                >
                  Recent Bookings
                </Text>
                {data.recentBookings.map((b) => (
                  <Card key={b._id} style={{ marginBottom: 8, padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                        {(b.unitId as any)?.unitNumber || 'Unit'} • {(b.customerId as any)?.name || 'Customer'}
                      </Text>
                      <Badge label={(b.status || 'pending').toUpperCase()} tone={b.status === 'confirmed' ? 'success' : 'warning'} />
                    </View>
                    <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 4 }}>
                      Booking: {b.bookingNumber} • ₹{Math.round(b.totalValue).toLocaleString('en-IN')}
                    </Text>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
