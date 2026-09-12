import type { Types } from 'mongoose';

/**
 * Canonical enterprise roles. Legacy roles ('manager', 'engineer') remain
 * valid and are normalised to their canonical equivalents at runtime.
 */
export type UserRole =
  | 'super_admin'
  | 'owner'
  | 'project_manager'
  | 'site_engineer'
  | 'accountant'
  | 'sales_manager'
  | 'supervisor'
  // Legacy aliases kept for backwards compatibility with existing accounts.
  | 'manager'
  | 'engineer'
  | 'worker';

/** Legacy role → canonical role. */
export const ROLE_ALIASES: Record<string, string> = {
  manager: 'project_manager',
  engineer: 'site_engineer',
};

export function normalizeRole(role: string): string {
  return ROLE_ALIASES[role] ?? role;
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type WorkerType =
  | 'mason'
  | 'helper'
  | 'electrician'
  | 'plumber'
  | 'carpenter'
  | 'painter'
  | 'welder'
  | 'operator'
  | 'other';
export type WorkerStatus = 'active' | 'inactive' | 'terminated';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';
export type MaterialCategory =
  | 'cement'
  | 'steel'
  | 'sand'
  | 'aggregate'
  | 'bricks'
  | 'tiles'
  | 'plumbing'
  | 'electrical'
  | 'paint'
  | 'hardware'
  | 'other';
export type MaterialUnit =
  | 'bag'
  | 'kg'
  | 'quintal'
  | 'ton'
  | 'brass'
  | 'cft'
  | 'sqft'
  | 'litre'
  | 'meter'
  | 'roll'
  | 'piece'
  | 'packet'
  | 'box'
  | 'trip'
  | 'other';
export type TransactionType = 'purchase' | 'usage' | 'adjustment' | 'return';
export type ExpenseCategory =
  | 'materials'
  | 'labor'
  | 'transportation'
  | 'equipment'
  | 'electricity'
  | 'permits'
  | 'food'
  | 'maintenance'
  | 'miscellaneous';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'humid' | 'windy' | 'other';
export type PhotoCategory = 'progress' | 'material' | 'issue' | 'safety' | 'completion';
export type NotificationType =
  | 'low_stock'
  | 'overdue_task'
  | 'expense'
  | 'attendance'
  | 'milestone'
  | 'report_reminder'
  | 'general'
  | 'payment_overdue'
  | 'milestone_delay'
  | 'contractor_bill'
  | 'purchase_approval'
  | 'expense_approval'
  | 'new_booking'
  | 'pending_task'
  | 'document_expiry';

export type UnitStatus =
  | 'available'
  | 'reserved'
  | 'booked'
  | 'sold'
  | 'blocked'
  | 'cancelled';
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'site_visit_scheduled'
  | 'site_visit_completed'
  | 'proposal_sent'
  | 'negotiation'
  | 'booked'
  | 'lost';
export type LeadSource =
  | 'website'
  | 'walk_in'
  | 'reference'
  | 'facebook'
  | 'instagram'
  | 'broker'
  | 'other';
export type CustomerJourneyStage =
  | 'inquiry'
  | 'visit'
  | 'negotiation'
  | 'booking'
  | 'payment'
  | 'possession';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'sold';
export type PaymentType = 'booking_amount' | 'installment' | 'milestone' | 'final';
export type CustomerPaymentMethod =
  | PaymentMethod
  | 'cheque'
  | 'loan';
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';
export type StructureNodeType =
  | 'phase'
  | 'block'
  | 'floor'
  | 'unit'
  | 'zone'
  | 'area'
  | 'custom';
export type ConstructionStageName =
  | 'excavation'
  | 'foundation'
  | 'rcc_structure'
  | 'brickwork'
  | 'plaster'
  | 'electrical'
  | 'plumbing'
  | 'flooring'
  | 'painting'
  | 'finishing'
  | 'landscaping'
  | 'handover'
  | 'custom';
export type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';
export type ContractorWorkType =
  | 'rcc'
  | 'brickwork'
  | 'plumbing'
  | 'electrical'
  | 'painting'
  | 'flooring'
  | 'interior'
  | 'other';
export type ContractPaymentType = 'advance' | 'running_bill' | 'final_settlement';
export type PurchaseOrderStatus =
  | 'draft'
  | 'approved'
  | 'ordered'
  | 'delivered'
  | 'closed'
  | 'cancelled';
export type ApprovalEntityType = 'expense' | 'purchase_order' | 'booking' | 'custom';
export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

/** Dynamic permission keys — mirrored on the mobile client. */
export const PERMISSIONS = [
  // Dashboard & reports
  'canViewDashboard',
  'canViewFinancials',
  'canManageReports',
  // Projects
  'canCreateProject',
  'canEditProject',
  'canDeleteProject',
  'canManageStructure',
  'canManageProgress',
  // Field operations
  'canMarkAttendance',
  'canSubmitDailyReports',
  'canManageWorkers',
  'canManageMaterials',
  'canManageTasks',
  'canUploadMedia',
  // Finance
  'canManageExpenses',
  'canApproveExpenses',
  'canManagePayments',
  'canViewReceivables',
  // Sales
  'canManageCustomers',
  'canManageLeads',
  'canManageBookings',
  'canApproveBookings',
  'canManageUnits',
  // Procurement
  'canManageVendors',
  'canManageContractors',
  'canManagePurchaseOrders',
  'canApprovePurchases',
  'canManageEquipment',
  // Governance
  'canManageDocuments',
  'canManageTeam',
  'canManageCompany',
  'canManageRoles',
  'canAuditLogs',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface AuthUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  companyId?: Types.ObjectId | null;
  assignedProjects: Types.ObjectId[];
  isActive: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
