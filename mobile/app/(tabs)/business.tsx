import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import { useRbac } from '@/lib/rbac';
import type { PermissionKey } from '@/types';

type CategoryId = 'all' | 'sales' | 'property' | 'site' | 'procurement' | 'governance';

type Tone = 'primary' | 'navy' | 'success' | 'warning' | 'info' | 'danger';

interface HubItem {
  id: string;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  category: CategoryId;
  tag?: string;
  tone?: Tone;
  keywords?: string[];
  perm?: PermissionKey[];
}

interface CategoryTab {
  id: CategoryId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: CategoryTab[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'sales', label: 'Sales & CRM', icon: 'people-outline' },
  { id: 'property', label: 'Property ERP', icon: 'business-outline' },
  { id: 'site', label: 'Site Ops', icon: 'hammer-outline' },
  { id: 'procurement', label: 'Procurement', icon: 'cart-outline' },
  { id: 'governance', label: 'Governance', icon: 'shield-checkmark-outline' },
];

const ALL_HUB_ITEMS: HubItem[] = [
  // ── 1. Property ERP ──────────────────────────────────────────────
  {
    id: 'prop-dashboard',
    label: 'Property Dashboard',
    sublabel: 'Executive KPI & real estate cockpit',
    icon: 'speedometer-outline',
    route: '/property/dashboard',
    category: 'property',
    tag: 'Cockpit',
    tone: 'navy',
    keywords: ['kpi', 'real estate', 'stats', 'rera', 'occupancy'],
    perm: ['canViewDashboard'],
  },
  {
    id: 'prop-projects',
    label: 'Property Projects',
    sublabel: 'RERA registered developments & phases',
    icon: 'business-outline',
    route: '/property/projects',
    category: 'property',
    tag: 'RERA',
    tone: 'navy',
    keywords: ['rera', 'scheme', 'builder', 'phase'],
    perm: ['canCreateProject', 'canEditProject'],
  },
  {
    id: 'prop-towers',
    label: 'Towers & Wings',
    sublabel: 'Wings, towers & structural blocks',
    icon: 'business',
    route: '/property/towers',
    category: 'property',
    tag: 'Structure',
    tone: 'navy',
    keywords: ['wing', 'tower', 'block', 'elevation'],
    perm: ['canManageTowers', 'canManageStructure'],
  },
  {
    id: 'prop-floors',
    label: 'Floors Layout',
    sublabel: 'Floor levels & storey plans',
    icon: 'layers-outline',
    route: '/property/floors',
    category: 'property',
    tag: 'Levels',
    tone: 'navy',
    keywords: ['storey', 'level', 'floor plan', 'units per floor'],
    perm: ['canManageFloors', 'canManageStructure'],
  },
  {
    id: 'prop-flats',
    label: 'Flats & Apartments',
    sublabel: 'Residential inventory, BHK specs & rates',
    icon: 'home-outline',
    route: '/property/flats',
    category: 'property',
    tag: 'Residential',
    tone: 'navy',
    keywords: ['flat', 'apartment', 'bhk', 'unit', 'pricing'],
    perm: ['canManageFlats', 'canManageUnits'],
  },
  {
    id: 'prop-shops',
    label: 'Commercial Shops',
    sublabel: 'Retail & showroom inventory',
    icon: 'storefront-outline',
    route: '/property/shops',
    category: 'property',
    tag: 'Commercial',
    tone: 'navy',
    keywords: ['shop', 'retail', 'showroom', 'commercial', 'frontage'],
    perm: ['canManageShops', 'canManageUnits'],
  },
  {
    id: 'prop-customers',
    label: 'Buyers & CRM (360°)',
    sublabel: 'KYC, bookings, dues & buyer ledgers',
    icon: 'people-circle-outline',
    route: '/property/customers',
    category: 'property',
    tag: 'KYC & CRM',
    tone: 'navy',
    keywords: ['buyer', 'client', 'pan', 'aadhaar', 'allotment'],
    perm: ['canManageCustomers'],
  },
  {
    id: 'prop-bookings',
    label: 'Property Bookings',
    sublabel: 'Sales, payment milestones & agreements',
    icon: 'bookmark-outline',
    route: '/property/bookings',
    category: 'property',
    tag: 'Sales Flow',
    tone: 'navy',
    keywords: ['booking', 'sale', 'agreement', 'allotment', 'token'],
    perm: ['canManageBookings'],
  },
  {
    id: 'prop-payments',
    label: 'Receivables & Dues',
    sublabel: 'Record installments & collections',
    icon: 'cash-outline',
    route: '/property/payments',
    category: 'property',
    tag: 'Collections',
    tone: 'navy',
    keywords: ['installment', 'due', 'overdue', 'cheque', 'neft', 'collection'],
    perm: ['canManagePayments', 'canViewReceivables'],
  },
  {
    id: 'prop-receipts',
    label: 'Official Receipts (QR)',
    sublabel: 'Instant PDF receipts & verification',
    icon: 'receipt-outline',
    route: '/property/receipts',
    category: 'property',
    tag: 'Instant PDF',
    tone: 'navy',
    keywords: ['receipt', 'pdf', 'qr code', 'payment slip', 'rcp'],
    perm: ['canGenerateReceipts', 'canManagePayments'],
  },
  {
    id: 'prop-banakhat',
    label: 'Banakhat (Agreement)',
    sublabel: 'RERA legal agreement generator',
    icon: 'document-attach-outline',
    route: '/property/banakhat',
    category: 'property',
    tag: 'Legal RERA',
    tone: 'navy',
    keywords: ['banakhat', 'agreement for sale', 'rera draft', 'legal'],
    perm: ['canGenerateBanakhat', 'canManageBookings'],
  },
  {
    id: 'prop-dastavej',
    label: 'Dastavej (Sale Deed)',
    sublabel: 'Conveyance deed & registration',
    icon: 'ribbon-outline',
    route: '/property/dastavej',
    category: 'property',
    tag: 'Sale Deed',
    tone: 'navy',
    keywords: ['dastavej', 'sale deed', 'registration', 'conveyance'],
    perm: ['canGenerateDastavej', 'canManageBookings'],
  },
  {
    id: 'prop-reports',
    label: 'Property Reports',
    sublabel: 'Excel & PDF registers & ledgers',
    icon: 'stats-chart-outline',
    route: '/property/reports',
    category: 'property',
    tag: 'Reports',
    tone: 'navy',
    keywords: ['register', 'excel', 'ledger', 'sales register'],
    perm: ['canViewPropertyReports', 'canManageReports'],
  },
  {
    id: 'prop-import',
    label: 'Excel Bulk Import',
    sublabel: 'Bulk import towers, floors & units',
    icon: 'cloud-upload-outline',
    route: '/property/import',
    category: 'property',
    tag: 'Batch Tool',
    tone: 'navy',
    keywords: ['import', 'excel', 'csv', 'bulk', 'upload'],
    perm: ['canImportInventory', 'canManageUnits'],
  },

  // ── 2. Sales & CRM ───────────────────────────────────────────────
  {
    id: 'sales-leads',
    label: 'Enquiry Leads',
    sublabel: 'Pipeline stages & follow-up tracking',
    icon: 'trending-up-outline',
    route: '/business/leads',
    category: 'sales',
    tag: 'Pipeline',
    tone: 'success',
    keywords: ['lead', 'prospect', 'enquiry', 'pipeline', 'followup', 'crm'],
    perm: ['canManageLeads'],
  },
  {
    id: 'sales-customers',
    label: 'CRM Customers',
    sublabel: 'Buyer directory & relationship journey',
    icon: 'people-outline',
    route: '/business/customers',
    category: 'sales',
    tag: 'Directory',
    tone: 'success',
    keywords: ['customer', 'client', 'buyer', 'directory'],
    perm: ['canManageCustomers'],
  },
  {
    id: 'sales-bookings',
    label: 'Unit Bookings',
    sublabel: 'Unit sales status & payment milestones',
    icon: 'file-tray-full-outline',
    route: '/business/bookings',
    category: 'sales',
    tag: 'Bookings',
    tone: 'success',
    keywords: ['booking', 'sale', 'allotment', 'stage'],
    perm: ['canManageBookings'],
  },
  {
    id: 'sales-receivables',
    label: 'Receivables & Alerts',
    sublabel: 'Collections & overdue stage alerts',
    icon: 'hand-left-outline',
    route: '/business/receivables',
    category: 'sales',
    tag: 'Dues',
    tone: 'success',
    keywords: ['receivable', 'due', 'overdue', 'aging', 'reminder'],
    perm: ['canManagePayments', 'canViewReceivables'],
  },
  {
    id: 'sales-inventory',
    label: 'Unit Inventory Status',
    sublabel: 'Availability matrix, sizes & base pricing',
    icon: 'grid-outline',
    route: '/business/inventory',
    category: 'sales',
    tag: 'Inventory',
    tone: 'success',
    keywords: ['inventory', 'stock', 'flat', 'shop', 'vacant', 'sold'],
    perm: ['canManageUnits', 'canManageBookings'],
  },

  // ── 3. Site Construction Operations ──────────────────────────────
  {
    id: 'site-contractors',
    label: 'Contractors & Work Orders',
    sublabel: 'Sub-contracts, running bills & advances',
    icon: 'hammer-outline',
    route: '/business/contractors',
    category: 'site',
    tag: 'Running Bills',
    tone: 'warning',
    keywords: ['contractor', 'labor', 'subcontractor', 'ra bill', 'measurement'],
    perm: ['canManageContractors'],
  },
  {
    id: 'site-milestones',
    label: 'Project Milestones',
    sublabel: 'Construction deadlines, slabs & delays',
    icon: 'flag-outline',
    route: '/business/milestones',
    category: 'site',
    tag: 'Schedule',
    tone: 'warning',
    keywords: ['milestone', 'schedule', 'gantt', 'timeline', 'slab', 'delay'],
    perm: ['canManageProgress', 'canViewFinancials'],
  },
  {
    id: 'site-equipment',
    label: 'Machinery & Equipment',
    sublabel: 'Heavy plant, cranes, logbooks & fuel',
    icon: 'cog-outline',
    route: '/business/equipment',
    category: 'site',
    tag: 'Fleet',
    tone: 'warning',
    keywords: ['equipment', 'machinery', 'crane', 'generator', 'fuel', 'asset'],
    perm: ['canManageEquipment'],
  },

  // ── 4. Procurement & Supply Chain ────────────────────────────────
  {
    id: 'proc-vendors',
    label: 'Vendors & Suppliers',
    sublabel: 'Supplier master directory & trade terms',
    icon: 'storefront-outline',
    route: '/business/vendors',
    category: 'procurement',
    tag: 'Vendors',
    tone: 'primary',
    keywords: ['vendor', 'supplier', 'material', 'cement', 'steel', 'sand'],
    perm: ['canManageVendors'],
  },
  {
    id: 'proc-purchase-orders',
    label: 'Purchase Orders',
    sublabel: 'PO drafting, approvals & GRN deliveries',
    icon: 'cart-outline',
    route: '/business/purchase-orders',
    category: 'procurement',
    tag: 'PO & GRN',
    tone: 'primary',
    keywords: ['purchase order', 'po', 'procurement', 'delivery', 'grn', 'bill'],
    perm: ['canManagePurchaseOrders', 'canApprovePurchases'],
  },

  // ── 5. Governance & Financials ───────────────────────────────────
  {
    id: 'gov-approvals',
    label: 'Authorizations & Approvals',
    sublabel: 'Expenses, POs & booking clearances',
    icon: 'checkmark-done-outline',
    route: '/business/approvals',
    category: 'governance',
    tag: 'Approvals',
    tone: 'info',
    keywords: ['approval', 'authorize', 'signoff', 'pending', 'expense approval'],
    perm: ['canApproveExpenses', 'canApprovePurchases', 'canApproveBookings', 'canManageExpenses'],
  },
  {
    id: 'gov-documents',
    label: 'Document Repository',
    sublabel: 'Drawings, RERA NOCs & digital agreements',
    icon: 'folder-open-outline',
    route: '/business/documents',
    category: 'governance',
    tag: 'Vault',
    tone: 'info',
    keywords: ['document', 'drawing', 'blueprint', 'noc', 'rera certificate', 'vault'],
    perm: ['canManageDocuments'],
  },
  {
    id: 'gov-reports',
    label: 'Business Reports',
    sublabel: 'Comprehensive management report packs',
    icon: 'document-text-outline',
    route: '/business/reports',
    category: 'governance',
    tag: 'Exports',
    tone: 'info',
    keywords: ['report', 'export', 'pdf', 'excel', 'summary', 'audit'],
    perm: ['canManageReports', 'canViewFinancials'],
  },
  {
    id: 'gov-analytics',
    label: 'Financial Analytics',
    sublabel: 'Cashflow, profitability & cost cockpit',
    icon: 'stats-chart-outline',
    route: '/business/analytics',
    category: 'governance',
    tag: 'Financials',
    tone: 'info',
    keywords: ['analytics', 'cashflow', 'margin', 'profit', 'financial', 'executive'],
    perm: ['canViewFinancials'],
  },
  {
    id: 'gov-audit-logs',
    label: 'System Audit Trail',
    sublabel: 'Immutable log of user actions & timestamps',
    icon: 'receipt-outline',
    route: '/business/audit-logs',
    category: 'governance',
    tag: 'Security',
    tone: 'info',
    keywords: ['audit', 'log', 'security', 'history', 'trail', 'timestamp'],
    perm: ['canAuditLogs'],
  },
];

export default function BusinessScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { canAny, role } = useRbac();
  const { colors, spacing, radius } = theme;

  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // RBAC filter
  const allowedItems = useMemo(() => {
    return ALL_HUB_ITEMS.filter(
      (item) => !item.perm || canAny(item.perm) || role === 'super_admin',
    );
  }, [canAny, role]);

  // Query & Category filter
  const filteredItems = useMemo(() => {
    let list = allowedItems;

    if (selectedCategory !== 'all') {
      list = list.filter((item) => item.category === selectedCategory);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const inLabel = item.label.toLowerCase().includes(q);
        const inSub = item.sublabel.toLowerCase().includes(q);
        const inTag = item.tag?.toLowerCase().includes(q);
        const inKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));
        return inLabel || inSub || inTag || inKeywords;
      });
    }

    return list;
  }, [allowedItems, selectedCategory, searchQuery]);

  const canApprove = canAny([
    'canApproveExpenses',
    'canApprovePurchases',
    'canApproveBookings',
    'canManageExpenses',
  ]);

  const getToneColors = (tone?: Tone) => {
    switch (tone) {
      case 'navy':
        return { bg: colors.navySoft, fg: colors.navy };
      case 'success':
        return { bg: colors.successSoft, fg: colors.success };
      case 'warning':
        return { bg: colors.warningSoft, fg: colors.warning };
      case 'danger':
        return { bg: colors.dangerSoft, fg: colors.danger };
      case 'info':
        return { bg: colors.infoSoft, fg: colors.info };
      case 'primary':
      default:
        return { bg: colors.primaryMuted, fg: colors.primary };
    }
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Operations Hub"
        subtitle={`${allowedItems.length} business tools & ERP modules`}
        large
        right={
          canApprove ? (
            <Pressable
              onPress={() => router.push('/business/approvals' as never)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Approvals"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.full,
              }}
            >
              <Ionicons name="checkmark-done-circle" size={16} color={colors.info} />
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Approvals</Text>
            </Pressable>
          ) : null
        }
      />

      {/* Top Search Bar */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search modules, deeds, flats, POs…"
        />
      </View>

      {/* Category Filter Pills (hidden when searching for clarity) */}
      {!isSearching ? (
        <View style={{ marginBottom: spacing.sm }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? allowedItems.length
                  : allowedItems.filter((i) => i.category === cat.id).length;

              if (count === 0 && cat.id !== 'all') return null;

              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 13,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={active ? colors.onPrimary : colors.textMuted}
                  />
                  <Text
                    style={{
                      color: active ? colors.onPrimary : colors.text,
                      fontSize: 12.5,
                      fontWeight: active ? '700' : '600',
                    }}
                  >
                    {cat.label}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                      borderRadius: radius.full,
                      backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.surfaceAlt,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.onPrimary : colors.textFaint,
                        fontSize: 10.5,
                        fontWeight: '700',
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 120,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HIGH-FREQUENCY DAILY ACTIONS (Shown when on 'all' and not searching) ── */}
        {!isSearching && selectedCategory === 'all' ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text
              style={{
                color: colors.textFaint,
                fontSize: 11.5,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Quick Actions
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'New Lead', icon: 'person-add-outline', route: '/modal/lead', color: colors.success },
                { label: 'Record Due', icon: 'cash-outline', route: '/modal/payment', color: colors.primary },
                { label: 'Booking', icon: 'bookmark-outline', route: '/modal/booking', color: colors.navy },
                { label: 'Create PO', icon: 'cart-outline', route: '/modal/purchase-order', color: colors.info },
              ].map((btn) => (
                <Pressable
                  key={btn.route}
                  onPress={() => router.push(btn.route as never)}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingVertical: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <Ionicons name={btn.icon as never} size={15} color={btn.color} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}
                  >
                    {btn.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── FEATURED HERO CARD: PROPERTY ERP COCKPIT (Shown on 'all' or 'property') ── */}
        {!isSearching && (selectedCategory === 'all' || selectedCategory === 'property') ? (
          <View
            style={{
              backgroundColor: colors.navy,
              borderRadius: radius.lg,
              padding: 16,
              marginBottom: spacing.lg,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.full,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                    RERA SUITE
                  </Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  Real Estate Cockpit
                </Text>
              </View>
              <Ionicons name="sparkles" size={16} color="#F59E0B" />
            </View>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '800',
                letterSpacing: -0.3,
                marginTop: 8,
              }}
            >
              Property ERP & Builder Cockpit
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 12.5,
                lineHeight: 18,
                marginTop: 4,
              }}
            >
              Track schemes, units, RERA legal agreements (Banakhat), conveyance deeds & instant QR receipts.
            </Text>

            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Flats & Shops', route: '/property/flats' },
                { label: 'Banakhat Draft', route: '/property/banakhat' },
                { label: 'QR Receipts', route: '/property/receipts' },
                { label: 'Excel Import', route: '/property/import' },
              ].map((chip) => (
                <Pressable
                  key={chip.route}
                  onPress={() => router.push(chip.route as never)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    borderRadius: radius.sm,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '600' }}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/property/dashboard' as never)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: 10,
                marginTop: 14,
                gap: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="speedometer-outline" size={16} color={colors.onPrimary} />
              <Text style={{ color: colors.onPrimary, fontSize: 13, fontWeight: '700' }}>
                Open Property Cockpit
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : null}

        {/* ── SEARCH STATUS STRIP ── */}
        {isSearching ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Found <Text style={{ color: colors.text, fontWeight: '700' }}>{filteredItems.length}</Text>{' '}
              {filteredItems.length === 1 ? 'module' : 'modules'} matching "{searchQuery.trim()}"
            </Text>
            <Pressable onPress={() => setSearchQuery('')}>
              <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '700' }}>Clear</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── EMPTY SEARCH / NO ACCESS STATE ── */}
        {filteredItems.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 24,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: spacing.md,
            }}
          >
            <Ionicons name="search-outline" size={36} color={colors.textFaint} style={{ marginBottom: 8 }} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>No matching modules</Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13,
                textAlign: 'center',
                marginTop: 4,
                lineHeight: 18,
              }}
            >
              {isSearching
                ? `No tools match "${searchQuery}". Try searching for deeds, flat, bill, PO, or reports.`
                : 'No modules available for your current permission role.'}
            </Text>
            {isSearching ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={{
                  marginTop: 14,
                  backgroundColor: colors.primaryMuted,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radius.full,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Reset search</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* ── MODULE LIST / CARDS ── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          {filteredItems.map((item, index) => {
            const toneStyle = getToneColors(item.tone);
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(item.route as never)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                })}
              >
                {/* Icon box with thematic accent color */}
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    backgroundColor: toneStyle.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name={item.icon} size={20} color={toneStyle.fg} />
                </View>

                {/* Content */}
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.text,
                        fontSize: 14.5,
                        fontWeight: '700',
                        letterSpacing: -0.2,
                      }}
                    >
                      {item.label}
                    </Text>
                    {item.tag ? (
                      <View
                        style={{
                          backgroundColor: colors.surfaceAlt,
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: colors.textFaint, fontSize: 9.5, fontWeight: '700' }}>
                          {item.tag}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}
                  >
                    {item.sublabel}
                  </Text>
                </View>

                {/* Trailing arrow */}
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
