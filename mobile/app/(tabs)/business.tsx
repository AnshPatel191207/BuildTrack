import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/hooks/useTheme';
import { useRbac } from '@/lib/rbac';
import type { PermissionKey } from '@/types';

interface HubItem {
  label: string;
  sublabel: string;
  icon: string;
  route: string;
  perm?: PermissionKey[];
  badgePerm?: PermissionKey;
}

interface HubSection {
  title: string;
  items: HubItem[];
}

export default function BusinessScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { canAny, role } = useRbac();
  const { colors, spacing, radius } = theme;

  const sections: HubSection[] = [
    {
      title: 'Property ERP (Builder & Real Estate)',
      items: [
        {
          label: 'Property Dashboard',
          sublabel: 'Executive KPI & real estate cockpit',
          icon: 'speedometer-outline',
          route: '/property/dashboard',
          perm: ['canViewDashboard'],
        },
        {
          label: 'Property Projects',
          sublabel: 'RERA registered developments',
          icon: 'business-outline',
          route: '/property/projects',
          perm: ['canCreateProject', 'canEditProject'],
        },
        {
          label: 'Towers & Wings',
          sublabel: 'Wings, towers & structural blocks',
          icon: 'business',
          route: '/property/towers',
          perm: ['canManageTowers', 'canManageStructure'],
        },
        {
          label: 'Floors',
          sublabel: 'Floor levels & storey plans',
          icon: 'layers-outline',
          route: '/property/floors',
          perm: ['canManageFloors', 'canManageStructure'],
        },
        {
          label: 'Flats & Apartments',
          sublabel: 'Residential inventory & pricing',
          icon: 'home-outline',
          route: '/property/flats',
          perm: ['canManageFlats', 'canManageUnits'],
        },
        {
          label: 'Commercial Shops',
          sublabel: 'Retail & showroom inventory',
          icon: 'storefront-outline',
          route: '/property/shops',
          perm: ['canManageShops', 'canManageUnits'],
        },
        {
          label: 'Buyers & CRM (360°)',
          sublabel: 'KYC, bookings, dues & receipts',
          icon: 'people-circle-outline',
          route: '/property/customers',
          perm: ['canManageCustomers'],
        },
        {
          label: 'Property Bookings',
          sublabel: 'Sales, discounts & milestones',
          icon: 'document-text-outline',
          route: '/property/bookings',
          perm: ['canManageBookings'],
        },
        {
          label: 'Receivables & Dues',
          sublabel: 'Record installments & collections',
          icon: 'cash-outline',
          route: '/property/payments',
          perm: ['canManagePayments', 'canViewReceivables'],
        },
        {
          label: 'Official Receipts (QR)',
          sublabel: 'Instant PDF receipts & verification',
          icon: 'receipt-outline',
          route: '/property/receipts',
          perm: ['canGenerateReceipts', 'canManagePayments'],
        },
        {
          label: 'Banakhat (Agreement)',
          sublabel: 'RERA legal agreement generator',
          icon: 'document-attach-outline',
          route: '/property/banakhat',
          perm: ['canGenerateBanakhat', 'canManageBookings'],
        },
        {
          label: 'Dastavej (Sale Deed)',
          sublabel: 'Conveyance deed & registration',
          icon: 'ribbon-outline',
          route: '/property/dastavej',
          perm: ['canGenerateDastavej', 'canManageBookings'],
        },
        {
          label: 'Property Reports',
          sublabel: 'Excel & PDF registers & ledgers',
          icon: 'stats-chart-outline',
          route: '/property/reports',
          perm: ['canViewPropertyReports', 'canManageReports'],
        },
        {
          label: 'Excel Bulk Import',
          sublabel: 'Bulk import towers, floors & units',
          icon: 'cloud-upload-outline',
          route: '/property/import',
          perm: ['canImportInventory', 'canManageUnits'],
        },
      ],
    },
    {
      title: 'Sales & CRM',
      items: [
        {
          label: 'Customers',
          sublabel: 'Buyer directory & journey',
          icon: 'people-circle-outline',
          route: '/business/customers',
          perm: ['canManageCustomers'],
        },
        {
          label: 'Leads',
          sublabel: 'Pipeline & follow-ups',
          icon: 'trending-up-outline',
          route: '/business/leads',
          perm: ['canManageLeads'],
        },
        {
          label: 'Bookings',
          sublabel: 'Unit bookings & sales flow',
          icon: 'file-tray-full-outline',
          route: '/business/bookings',
          perm: ['canManageBookings'],
        },
        {
          label: 'Receivables',
          sublabel: 'Collections & overdue alerts',
          icon: 'hand-left-outline',
          route: '/business/receivables',
          perm: ['canManagePayments', 'canViewReceivables'],
        },
        {
          label: 'Unit Inventory',
          sublabel: 'Availability & pricing',
          icon: 'grid-outline',
          route: '/business/inventory',
          perm: ['canManageUnits', 'canManageBookings'],
        },
      ],
    },
    {
      title: 'Construction',
      items: [
        {
          label: 'Contractors',
          sublabel: 'Contracts & running bills',
          icon: 'hammer-outline',
          route: '/business/contractors',
          perm: ['canManageContractors'],
        },
        {
          label: 'Milestones',
          sublabel: 'Deadlines & delays',
          icon: 'flag-outline',
          route: '/business/milestones',
          perm: ['canManageProgress', 'canViewFinancials'],
        },
        {
          label: 'Equipment',
          sublabel: 'Machinery & utilisation',
          icon: 'cog-outline',
          route: '/business/equipment',
          perm: ['canManageEquipment'],
        },
      ],
    },
    {
      title: 'Procurement',
      items: [
        {
          label: 'Vendors',
          sublabel: 'Supplier directory',
          icon: 'storefront-outline',
          route: '/business/vendors',
          perm: ['canManageVendors'],
        },
        {
          label: 'Purchase Orders',
          sublabel: 'PO workflow & deliveries',
          icon: 'cart-outline',
          route: '/business/purchase-orders',
          perm: ['canManagePurchaseOrders', 'canApprovePurchases'],
        },
      ],
    },
    {
      title: 'Company',
      items: [
        {
          label: 'Approvals',
          sublabel: 'Expenses, POs & bookings',
          icon: 'checkmark-done-outline',
          route: '/business/approvals',
          perm: ['canApproveExpenses', 'canApprovePurchases', 'canApproveBookings', 'canManageExpenses'],
        },
        {
          label: 'Documents',
          sublabel: 'Drawings, NOCs & agreements',
          icon: 'folder-open-outline',
          route: '/business/documents',
          perm: ['canManageDocuments'],
        },
        {
          label: 'Reports',
          sublabel: 'Ten report packs on demand',
          icon: 'document-text-outline',
          route: '/business/reports',
          perm: ['canManageReports', 'canViewFinancials'],
        },
        {
          label: 'Analytics',
          sublabel: 'Executive & financial cockpit',
          icon: 'stats-chart-outline',
          route: '/business/analytics',
          perm: ['canViewFinancials'],
        },
        {
          label: 'Audit Logs',
          sublabel: 'Who did what, when',
          icon: 'receipt-outline',
          route: '/business/audit-logs',
          perm: ['canAuditLogs'],
        },
      ],
    },
  ];

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.perm || canAny(item.perm) || role === 'super_admin',
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Business"
        subtitle="ERP suite for your company"
        large
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 120,
        }}
      >
        {visibleSections.length === 0 ? (
          <Text style={{ color: colors.textMuted, marginTop: spacing.lg }}>
            Your role does not include business modules.
          </Text>
        ) : null}
        {visibleSections.map((section) => (
          <View key={section.title} style={{ marginTop: spacing.lg }}>
            <Text
              style={{
                color: colors.textFaint,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {section.title}
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
              {section.items.map((item, index) => (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as never)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    opacity: pressed ? 0.75 : 1,
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.primaryMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={item.icon as never} size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                      {item.label}
                    </Text>
                    <Text style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 1 }}>
                      {item.sublabel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
