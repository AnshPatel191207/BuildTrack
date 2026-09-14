import { normalizeRole, type Permission, type UserRole } from '../types';

/**
 * Role → permissions matrix. Single source of truth for API authorisation.
 * The mobile client mirrors this matrix for UI gating; the server remains the
 * enforcing authority.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [
    'canViewDashboard',
    'canViewFinancials',
    'canManageReports',
    'canCreateProject',
    'canEditProject',
    'canDeleteProject',
    'canManageStructure',
    'canManageProgress',
    'canMarkAttendance',
    'canSubmitDailyReports',
    'canManageWorkers',
    'canManageMaterials',
    'canManageTasks',
    'canUploadMedia',
    'canManageExpenses',
    'canApproveExpenses',
    'canManagePayments',
    'canViewReceivables',
    'canManageCustomers',
    'canManageLeads',
    'canManageBookings',
    'canApproveBookings',
    'canManageUnits',
    'canManageTowers',
    'canManageFloors',
    'canManageFlats',
    'canManageShops',
    'canImportInventory',
    'canGenerateReceipts',
    'canGenerateBanakhat',
    'canGenerateDastavej',
    'canManageTemplates',
    'canViewPropertyReports',
    'canManageVendors',
    'canManageContractors',
    'canManagePurchaseOrders',
    'canApprovePurchases',
    'canManageEquipment',
    'canManageDocuments',
    'canManageTeam',
    'canManageCompany',
    'canManageRoles',
    'canAuditLogs',
  ],

  owner: [
    'canViewDashboard',
    'canViewFinancials',
    'canManageReports',
    'canCreateProject',
    'canEditProject',
    'canDeleteProject',
    'canManageStructure',
    'canManageProgress',
    'canMarkAttendance',
    'canSubmitDailyReports',
    'canManageWorkers',
    'canManageMaterials',
    'canManageTasks',
    'canUploadMedia',
    'canManageExpenses',
    'canApproveExpenses',
    'canManagePayments',
    'canViewReceivables',
    'canManageCustomers',
    'canManageLeads',
    'canManageBookings',
    'canApproveBookings',
    'canManageUnits',
    'canManageTowers',
    'canManageFloors',
    'canManageFlats',
    'canManageShops',
    'canImportInventory',
    'canGenerateReceipts',
    'canGenerateBanakhat',
    'canGenerateDastavej',
    'canManageTemplates',
    'canViewPropertyReports',
    'canManageVendors',
    'canManageContractors',
    'canManagePurchaseOrders',
    'canApprovePurchases',
    'canManageEquipment',
    'canManageDocuments',
    'canManageTeam',
    'canManageCompany',
    'canAuditLogs',
  ],

  admin: [
    'canViewDashboard',
    'canViewFinancials',
    'canManageReports',
    'canCreateProject',
    'canEditProject',
    'canDeleteProject',
    'canManageStructure',
    'canManageProgress',
    'canMarkAttendance',
    'canSubmitDailyReports',
    'canManageWorkers',
    'canManageMaterials',
    'canManageTasks',
    'canUploadMedia',
    'canManageExpenses',
    'canApproveExpenses',
    'canManagePayments',
    'canViewReceivables',
    'canManageCustomers',
    'canManageLeads',
    'canManageBookings',
    'canApproveBookings',
    'canManageUnits',
    'canManageTowers',
    'canManageFloors',
    'canManageFlats',
    'canManageShops',
    'canImportInventory',
    'canGenerateReceipts',
    'canGenerateBanakhat',
    'canGenerateDastavej',
    'canManageTemplates',
    'canViewPropertyReports',
    'canManageVendors',
    'canManageContractors',
    'canManagePurchaseOrders',
    'canApprovePurchases',
    'canManageEquipment',
    'canManageDocuments',
    'canManageTeam',
    'canManageCompany',
    'canAuditLogs',
  ],

  project_manager: [
    'canViewDashboard',
    'canManageReports',
    'canCreateProject',
    'canEditProject',
    'canManageStructure',
    'canManageProgress',
    'canMarkAttendance',
    'canSubmitDailyReports',
    'canManageWorkers',
    'canManageMaterials',
    'canManageTasks',
    'canUploadMedia',
    'canManageExpenses',
    'canApproveExpenses',
    'canManageVendors',
    'canManageContractors',
    'canManagePurchaseOrders',
    'canApprovePurchases',
    'canManageEquipment',
    'canManageDocuments',
    'canViewReceivables',
    'canManageTowers',
    'canManageFloors',
    'canViewPropertyReports',
  ],

  site_engineer: [
    'canViewDashboard',
    'canMarkAttendance',
    'canSubmitDailyReports',
    'canManageTasks',
    'canManageMaterials',
    'canUploadMedia',
    'canManageExpenses',
    'canManageProgress',
  ],

  accountant: [
    'canViewDashboard',
    'canViewFinancials',
    'canManageReports',
    'canManageExpenses',
    'canApproveExpenses',
    'canManagePayments',
    'canViewReceivables',
    'canManageVendors',
    'canGenerateReceipts',
    'canViewPropertyReports',
    'canAuditLogs',
  ],

  sales_manager: [
    'canViewDashboard',
    'canManageCustomers',
    'canManageLeads',
    'canManageBookings',
    'canManageUnits',
    'canManageTowers',
    'canManageFloors',
    'canManageFlats',
    'canManageShops',
    'canImportInventory',
    'canManagePayments',
    'canViewReceivables',
    'canGenerateReceipts',
    'canGenerateBanakhat',
    'canGenerateDastavej',
    'canManageTemplates',
    'canManageReports',
    'canManageDocuments',
    'canViewPropertyReports',
  ],

  sales_executive: [
    'canViewDashboard',
    'canManageCustomers',
    'canManageLeads',
    'canManageBookings',
    'canManageUnits',
    'canViewReceivables',
    'canGenerateReceipts',
    'canGenerateBanakhat',
  ],

  receptionist: [
    'canViewDashboard',
    'canManageCustomers',
    'canManageLeads',
  ],

  supervisor: [
    'canViewDashboard',
    'canMarkAttendance',
    'canSubmitDailyReports',
    'canManageWorkers',
    'canManageTasks',
    'canUploadMedia',
    'canManageProgress',
  ],

  worker: [],
};

const ALL_PERMISSIONS = new Set<string>(
  Object.values(ROLE_PERMISSIONS).flat(),
);

/** Effective permissions for a user role (legacy aliases normalised). */
export function permissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)] ?? [];
}

/** Runtime check used by middleware and controllers. */
export function hasPermission(
  role: string | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  if (normalizeRole(role) === 'super_admin') return true;
  return permissionsForRole(role).includes(permission);
}

export function hasAnyPermission(
  role: string | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Roles allowed to act at an approval level (used by the approval engine). */
export function rolesForApprovalLevel(level: number, chain: UserRole[]): UserRole[] {
  return chain[level] ? [chain[level]] : [];
}
