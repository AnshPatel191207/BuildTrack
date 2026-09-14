import React, { useState, useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { PropertyProject, PropertyDashboardStats } from '@/types';

function formatCurrency(amount?: number) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export default function PropertyReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedReportType, setSelectedReportType] = useState<
    'inventory' | 'sales' | 'collections' | 'outstanding' | 'legal'
  >('inventory');
  const [downloading, setDownloading] = useState(false);

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

  // Fetch dashboard stats for report preview
  const {
    data: stats,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyDashboardStats>(
    () => propertyService.getDashboardStats(selectedProjectId || undefined),
    [selectedProjectId],
  );

  const reportPacks = [
    {
      id: 'inventory',
      title: 'Unit Inventory Register',
      desc: 'Tower-wise and floor-wise availability, BHK mix, carpet area and unsold stock valuation.',
      icon: 'grid-outline',
    },
    {
      id: 'sales',
      title: 'Sales & Booking Register',
      desc: 'All allotted units, agreed prices, discounts, sales executives and booking lifecycle.',
      icon: 'document-text-outline',
    },
    {
      id: 'collections',
      title: 'Collection & Receipt Register',
      desc: 'Payments received, mode of payment (Cheque, NEFT, RTGS), UTR numbers and receipt numbers.',
      icon: 'cash-outline',
    },
    {
      id: 'outstanding',
      title: 'Outstanding & Dues Aging Ledger',
      desc: 'Receivables aging schedule, milestone delay days, and customer overdue balances.',
      icon: 'alert-circle-outline',
    },
    {
      id: 'legal',
      title: 'Banakhat & Dastavej Legal Register',
      desc: 'Agreement for Sale (Banakhat) and Conveyance Deed (Dastavej) execution & registration log.',
      icon: 'ribbon-outline',
    },
  ] as const;

  const handleExport = (format: 'excel' | 'pdf') => {
    try {
      setDownloading(true);
      const url = propertyService.getExportReportUrl({
        projectId: selectedProjectId || undefined,
        reportType: selectedReportType,
        format,
      });
      void Linking.openURL(url);
      showToast(`Exporting ${selectedReportType.toUpperCase()} ${format.toUpperCase()}...`, 'info');
    } catch {
      showToast('Could not initiate download', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Property Reports"
        subtitle="Audited registers, sales logs & Excel exports"
        large
        onBack={() => router.back()}
      />
      <OfflineBanner />

      {/* Project Selector Horizontal Scroll */}
      {projects && projects.length > 0 && (
        <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
            <Pressable
              onPress={() => setSelectedProjectId('')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: !selectedProjectId ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: !selectedProjectId ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: !selectedProjectId ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>
                All Projects
              </Text>
            </Pressable>
            {projects.map((p) => {
              const active = p._id === selectedProjectId;
              return (
                <Pressable
                  key={p._id}
                  onPress={() => setSelectedProjectId(p._id)}
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

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={140} />
            <Skeleton height={140} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load reports'} onRetry={reload} />
        ) : (
          <View style={{ gap: 16 }}>
            {/* Quick KPI Overview */}
            <Card style={{ padding: 18 }}>
              <Text style={{ fontSize: 12, color: colors.textFaint, textTransform: 'uppercase', fontWeight: '700' }}>
                Audited Property Metrics
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ fontSize: 11, color: colors.textFaint }}>Total Units</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                    {stats?.totalUnits || stats?.inventory?.totalUnits || 0}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.success }}>Available Units</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.success, marginTop: 2 }}>
                    {stats?.availableUnits || stats?.inventory?.availableUnits || 0}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.primary }}>Total Booked</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                    {stats?.bookedUnits || stats?.inventory?.bookedUnits || 0}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ fontSize: 11, color: colors.textFaint }}>Total Sales Value</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                    {formatCurrency(stats?.financials?.totalSalesValue || stats?.inventory?.bookedValue)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: colors.success }}>Total Collections</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.success, marginTop: 2 }}>
                    {formatCurrency(stats?.financials?.totalCollected || stats?.collections?.monthly)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Report Selector Header */}
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 }}>
              Select Report Pack to Download
            </Text>

            {/* Report Packs List */}
            <View style={{ gap: 10 }}>
              {reportPacks.map((pack) => {
                const active = selectedReportType === pack.id;
                return (
                  <Card
                    key={pack.id}
                    onPress={() => setSelectedReportType(pack.id)}
                    style={{
                      padding: 16,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: active ? colors.primary : colors.surfaceAlt,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name={pack.icon as any}
                          size={20}
                          color={active ? '#fff' : colors.primary}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                          {pack.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 16 }}>
                          {pack.desc}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Export Actions */}
            <Card style={{ padding: 18, gap: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                Download {selectedReportType.toUpperCase()}
              </Text>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Pressable
                    onPress={() => handleExport('excel')}
                    disabled={downloading}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#1D6F42',
                      paddingVertical: 12,
                      borderRadius: radius.md,
                    }}
                  >
                    <Ionicons name="grid-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Excel (.xlsx)</Text>
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <Pressable
                    onPress={() => handleExport('pdf')}
                    disabled={downloading}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#C53030',
                      paddingVertical: 12,
                      borderRadius: radius.md,
                    }}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>PDF Report</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
