import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useRbac } from '@/lib/rbac';
import type { PermissionKey } from '@/types';

const TAB_ICONS = {
  dashboard: ['grid-outline', 'grid'],
  projects: ['business-outline', 'business'],
  business: ['briefcase-outline', 'briefcase'],
  expenses: ['wallet-outline', 'wallet'],
  workers: ['people-outline', 'people'],
  profile: ['person-circle-outline', 'person-circle'],
} as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { canAny } = useRbac();

  // Role-aware navigation: hide the Business hub when a role has no ERP perms,
  // and hide operational tabs from roles that can't use them.
  const showBusiness = canAny([
    'canManageCustomers',
    'canManageLeads',
    'canManageBookings',
    'canManageUnits',
    'canViewReceivables' as PermissionKey,
    'canManageContractors',
    'canManageVendors',
    'canManagePurchaseOrders',
    'canApprovePurchases',
    'canApproveExpenses',
    'canManageEquipment',
    'canManageDocuments',
    'canManageReports',
    'canViewFinancials',
    'canAuditLogs',
  ]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => icon('dashboard', focused, colors.primary) }}
      />
      <Tabs.Screen
        name="projects"
        options={{ title: 'Projects', tabBarIcon: ({ focused }) => icon('projects', focused, colors.primary) }}
      />
      {showBusiness ? (
        <Tabs.Screen
          name="business"
          options={{ title: 'Business', tabBarIcon: ({ focused }) => icon('business2', focused, colors.primary) }}
        />
      ) : (
        <Tabs.Screen name="business" options={{ href: null }} />
      )}
      <Tabs.Screen
        name="expenses"
        options={{ title: 'Expenses', tabBarIcon: ({ focused }) => icon('expenses', focused, colors.primary) }}
      />
      <Tabs.Screen
        name="workers"
        options={{ title: 'Workers', tabBarIcon: ({ focused }) => icon('workers', focused, colors.primary) }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ focused }) => icon('profile', focused, colors.primary) }}
      />
    </Tabs>
  );
}

function icon(
  key: keyof typeof TAB_ICONS | 'business2',
  focused: boolean,
  color: string,
): React.ReactElement {
  if (key === 'business2') {
    return (
      <Ionicons
        name={(focused ? 'briefcase' : 'briefcase-outline') as keyof typeof Ionicons.glyphMap}
        size={23}
        color={color}
      />
    );
  }
  const [outline, filled] = TAB_ICONS[key];
  return (
    <Ionicons
      name={(focused ? filled : outline) as keyof typeof Ionicons.glyphMap}
      size={23}
      color={color}
    />
  );
}
