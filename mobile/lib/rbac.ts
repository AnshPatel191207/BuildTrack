import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { PermissionKey, User, UserRole } from '@/types';

/**
 * Client-side mirror of the server's permission matrix (utils/permissions.ts).
 * Used purely to gate the UI — the API enforces the real checks.
 */

const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  super_admin: [
    'canViewDashboard', 'canViewFinancials', 'canManageReports',
    'canCreateProject', 'canEditProject', 'canDeleteProject',
    'canManageStructure', 'canManageProgress',
    'canMarkAttendance', 'canSubmitDailyReports', 'canManageWorkers',
    'canManageMaterials', 'canManageTasks', 'canUploadMedia',
    'canManageExpenses', 'canApproveExpenses', 'canManagePayments', 'canViewReceivables',
    'canManageCustomers', 'canManageLeads', 'canManageBookings', 'canApproveBookings', 'canManageUnits',
    'canManageTowers', 'canManageFloors', 'canManageFlats', 'canManageShops', 'canImportInventory',
    'canGenerateReceipts', 'canGenerateBanakhat', 'canGenerateDastavej', 'canManageTemplates', 'canViewPropertyReports',
    'canManageVendors', 'canManageContractors', 'canManagePurchaseOrders', 'canApprovePurchases',
    'canManageEquipment', 'canManageDocuments', 'canManageTeam', 'canManageCompany',
    'canManageRoles', 'canAuditLogs',
  ],
  owner: [
    'canViewDashboard', 'canViewFinancials', 'canManageReports',
    'canCreateProject', 'canEditProject', 'canDeleteProject',
    'canManageStructure', 'canManageProgress',
    'canMarkAttendance', 'canSubmitDailyReports', 'canManageWorkers',
    'canManageMaterials', 'canManageTasks', 'canUploadMedia',
    'canManageExpenses', 'canApproveExpenses', 'canManagePayments', 'canViewReceivables',
    'canManageCustomers', 'canManageLeads', 'canManageBookings', 'canApproveBookings', 'canManageUnits',
    'canManageTowers', 'canManageFloors', 'canManageFlats', 'canManageShops', 'canImportInventory',
    'canGenerateReceipts', 'canGenerateBanakhat', 'canGenerateDastavej', 'canManageTemplates', 'canViewPropertyReports',
    'canManageVendors', 'canManageContractors', 'canManagePurchaseOrders', 'canApprovePurchases',
    'canManageEquipment', 'canManageDocuments', 'canManageTeam', 'canManageCompany', 'canAuditLogs',
  ],
  admin: [
    'canViewDashboard', 'canViewFinancials', 'canManageReports',
    'canCreateProject', 'canEditProject', 'canDeleteProject',
    'canManageStructure', 'canManageProgress',
    'canMarkAttendance', 'canSubmitDailyReports', 'canManageWorkers',
    'canManageMaterials', 'canManageTasks', 'canUploadMedia',
    'canManageExpenses', 'canApproveExpenses', 'canManagePayments', 'canViewReceivables',
    'canManageCustomers', 'canManageLeads', 'canManageBookings', 'canApproveBookings', 'canManageUnits',
    'canManageTowers', 'canManageFloors', 'canManageFlats', 'canManageShops', 'canImportInventory',
    'canGenerateReceipts', 'canGenerateBanakhat', 'canGenerateDastavej', 'canManageTemplates', 'canViewPropertyReports',
    'canManageVendors', 'canManageContractors', 'canManagePurchaseOrders', 'canApprovePurchases',
    'canManageEquipment', 'canManageDocuments', 'canManageTeam', 'canManageCompany', 'canAuditLogs',
  ],
  project_manager: [
    'canViewDashboard', 'canManageReports',
    'canCreateProject', 'canEditProject', 'canManageStructure', 'canManageProgress',
    'canMarkAttendance', 'canSubmitDailyReports', 'canManageWorkers',
    'canManageMaterials', 'canManageTasks', 'canUploadMedia',
    'canManageExpenses', 'canApproveExpenses', 'canViewReceivables',
    'canManageVendors', 'canManageContractors', 'canManagePurchaseOrders', 'canApprovePurchases',
    'canManageEquipment', 'canManageDocuments',
    'canManageTowers', 'canManageFloors', 'canViewPropertyReports',
  ],
  site_engineer: [
    'canViewDashboard', 'canMarkAttendance', 'canSubmitDailyReports',
    'canManageTasks', 'canManageMaterials', 'canUploadMedia',
    'canManageExpenses', 'canManageProgress',
  ],
  accountant: [
    'canViewDashboard', 'canViewFinancials', 'canManageReports',
    'canManageExpenses', 'canApproveExpenses', 'canManagePayments', 'canViewReceivables',
    'canManageVendors', 'canGenerateReceipts', 'canViewPropertyReports', 'canAuditLogs',
  ],
  sales_manager: [
    'canViewDashboard', 'canManageCustomers', 'canManageLeads', 'canManageBookings',
    'canManageUnits', 'canManageTowers', 'canManageFloors', 'canManageFlats', 'canManageShops',
    'canImportInventory', 'canManagePayments', 'canViewReceivables', 'canGenerateReceipts',
    'canGenerateBanakhat', 'canGenerateDastavej', 'canManageTemplates', 'canManageReports',
    'canManageDocuments', 'canViewPropertyReports',
  ],
  sales_executive: [
    'canViewDashboard', 'canManageCustomers', 'canManageLeads', 'canManageBookings',
    'canManageUnits', 'canViewReceivables', 'canGenerateReceipts', 'canGenerateBanakhat',
  ],
  receptionist: [
    'canViewDashboard', 'canManageCustomers', 'canManageLeads',
  ],
  supervisor: [
    'canViewDashboard', 'canMarkAttendance', 'canSubmitDailyReports',
    'canManageWorkers', 'canManageTasks', 'canUploadMedia', 'canManageProgress',
  ],
  worker: [],
};

export function normalizeRole(role: string | undefined | null): string {
  if (!role) return '';
  if (role === 'admin') return 'owner';
  if (role === 'manager') return 'project_manager';
  if (role === 'engineer') return 'site_engineer';
  return role;
}

export function permissionsForRole(role: string | undefined | null): PermissionKey[] {
  if (!role) return [];
  const canonical = normalizeRole(role);
  if (canonical === 'super_admin') {
    return Object.values(ROLE_PERMISSIONS).flat();
  }
  return ROLE_PERMISSIONS[canonical] ?? [];
}

export function userPermissions(user: User | null): Set<PermissionKey> {
  if (!user) return new Set();
  // Prefer server-provided permissions; fall back to the local matrix.
  if (user.permissions && user.permissions.length > 0) {
    return new Set(user.permissions);
  }
  return new Set(permissionsForRole(user.role));
}

export interface Rbac {
  role: UserRole;
  permissions: Set<PermissionKey>;
  can: (permission: PermissionKey) => boolean;
  canAny: (permissions: PermissionKey[]) => boolean;
}

export function useRbac(): Rbac {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => {
    const permissions = userPermissions(user);
    return {
      role: (user?.role ?? 'worker') as UserRole,
      permissions,
      can: (permission: PermissionKey) =>
        normalizeRole(user?.role) === 'super_admin' || permissions.has(permission),
      canAny: (list: PermissionKey[]) => list.some((p) => permissions.has(p)),
    };
  }, [user]);
}
