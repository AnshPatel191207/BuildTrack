import type {
  ApprovalStatus,
  BookingStatus,
  CustomerStage,
  Equipment,
  LeadStage,
  PaymentStatus,
  PurchaseOrderStatus,
  StageStatus,
  AttendanceStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  UnitStatus,
} from '@/types';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';

export const STATUS_TONES: Record<ProjectStatus, Tone> = {
  planning: 'info',
  active: 'success',
  on_hold: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
};

export const TASK_STATUS_TONES: Record<TaskStatus, Tone> = {
  todo: 'neutral',
  in_progress: 'info',
  completed: 'success',
  blocked: 'danger',
};

export const PRIORITY_TONES: Record<TaskPriority, Tone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

export const ATTENDANCE_TONES: Record<AttendanceStatus, Tone> = {
  present: 'success',
  absent: 'danger',
  half_day: 'warning',
  leave: 'info',
};

export const PROJECT_PHASE_LABELS = [
  { upTo: 15, label: 'Foundation & excavation' },
  { upTo: 40, label: 'Structure (RCC frame)' },
  { upTo: 65, label: 'Masonry & plastering' },
  { upTo: 85, label: 'MEP & finishing' },
  { upTo: 99, label: 'Final finishing & QC' },
  { upTo: 100, label: 'Handover' },
];

export function phaseLabel(progress: number): string {
  return PROJECT_PHASE_LABELS.find((p) => progress <= p.upTo)?.label ?? 'In progress';
}

// -- ERP status tones ---------------------------------------------

export const UNIT_STATUS_TONES: Record<UnitStatus, Tone> = {
  available: 'success',
  reserved: 'info',
  booked: 'orange',
  sold: 'neutral',
  blocked: 'danger',
  cancelled: 'danger',
};

export const LEAD_STAGE_TONES: Record<LeadStage, Tone> = {
  new: 'info',
  contacted: 'info',
  site_visit_scheduled: 'warning',
  site_visit_completed: 'warning',
  proposal_sent: 'orange',
  negotiation: 'orange',
  booked: 'success',
  lost: 'danger',
};

export const CUSTOMER_STAGE_TONES: Record<CustomerStage, Tone> = {
  inquiry: 'info',
  visit: 'info',
  negotiation: 'warning',
  booking: 'orange',
  payment: 'success',
  possession: 'success',
};

export const BOOKING_STATUS_TONES: Record<BookingStatus, Tone> = {
  pending: 'warning',
  confirmed: 'success',
  sold: 'neutral',
  cancelled: 'danger',
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, Tone> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'danger',
};

export const PO_STATUS_TONES: Record<PurchaseOrderStatus, Tone> = {
  draft: 'neutral',
  approved: 'info',
  ordered: 'orange',
  delivered: 'success',
  closed: 'neutral',
  cancelled: 'danger',
};

export const APPROVAL_STATUS_TONES: Record<string, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  changes_requested: 'orange',
};

export const STAGE_STATUS_TONES: Record<StageStatus, Tone> = {
  not_started: 'neutral',
  in_progress: 'info',
  completed: 'success',
  on_hold: 'warning',
};

export const MILESTONE_STATUS_TONES: Record<string, Tone> = {
  upcoming: 'info',
  completed: 'success',
  delayed: 'danger',
};

export const EQUIPMENT_STATUS_TONES: Record<Equipment['status'], Tone> = {
  active: 'success',
  idle: 'neutral',
  maintenance: 'warning',
  retired: 'danger',
};
