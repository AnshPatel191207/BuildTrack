import type {
  ApprovalEntityType,
  BookingStatus,
  ContractorPayment,
  ContractorWorkType,
  CustomerPaymentMethodType,
  CustomerStage,
  Equipment,
  ExpenseCategory,
  LeadSourceType,
  LeadStage,
  MaterialCategory,
  MaterialUnit,
  PaymentMethod,
  PaymentType,
  PhotoCategory,
  ProjectStatus,
  ProjectType,
  PurchaseOrderStatus,
  StageName,
  StageStatus,
  StructureNodeType,
  TaskPriority,
  TaskStatus,
  UnitStatus,
  UserRole,
  Weather,
  WorkerStatus,
  WorkerType,
} from '@/types';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  project_manager: 'Project Manager',
  site_engineer: 'Site Engineer',
  accountant: 'Accountant',
  sales_manager: 'Sales Manager',
  supervisor: 'Supervisor',
  manager: 'Project Manager',
  engineer: 'Site Engineer',
  worker: 'Worker',
};

export const PROJECT_STATUS_OPTIONS: Option<ProjectStatus>[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PROJECT_TYPE_OPTIONS: Option<ProjectType>[] = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'interior', label: 'Interior Fitout' },
  { value: 'other', label: 'Other' },
];

export const WORKER_TYPE_OPTIONS: Option<WorkerType>[] = [
  { value: 'mason', label: 'Mason (Rajmistri)' },
  { value: 'helper', label: 'Helper' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'carpenter', label: 'Carpenter' },
  { value: 'painter', label: 'Painter' },
  { value: 'welder', label: 'Welder' },
  { value: 'operator', label: 'Machine Operator' },
  { value: 'other', label: 'Other' },
];

export const WORKER_STATUS_OPTIONS: Option<WorkerStatus>[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Left Job' },
];

export const EXPENSE_CATEGORY_OPTIONS: Option<ExpenseCategory>[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'labor', label: 'Labour' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'permits', label: 'Permits & Fees' },
  { value: 'food', label: 'Food & Tea' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

export const PAYMENT_METHOD_OPTIONS: Option<PaymentMethod>[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export const MATERIAL_CATEGORY_OPTIONS: Option<MaterialCategory>[] = [
  { value: 'cement', label: 'Cement' },
  { value: 'steel', label: 'Steel' },
  { value: 'sand', label: 'Sand' },
  { value: 'aggregate', label: 'Aggregate' },
  { value: 'bricks', label: 'Bricks & Blocks' },
  { value: 'tiles', label: 'Tiles' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'paint', label: 'Paint' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
];

export const MATERIAL_UNIT_OPTIONS: Option<MaterialUnit>[] = [
  { value: 'bag', label: 'Bag' },
  { value: 'kg', label: 'Kg' },
  { value: 'quintal', label: 'Quintal' },
  { value: 'ton', label: 'Ton' },
  { value: 'brass', label: 'Brass' },
  { value: 'cft', label: 'CFT' },
  { value: 'sqft', label: 'Sq. ft.' },
  { value: 'litre', label: 'Litre' },
  { value: 'meter', label: 'Meter' },
  { value: 'roll', label: 'Roll' },
  { value: 'piece', label: 'Piece' },
  { value: 'packet', label: 'Packet' },
  { value: 'box', label: 'Box' },
  { value: 'trip', label: 'Trip' },
  { value: 'other', label: 'Other' },
];

export const TASK_PRIORITY_OPTIONS: Option<TaskPriority>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const TASK_STATUS_OPTIONS: Option<TaskStatus>[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

export const WEATHER_OPTIONS: Option<Weather>[] = [
  { value: 'sunny', label: 'Sunny' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'rainy', label: 'Rainy' },
  { value: 'humid', label: 'Humid' },
  { value: 'windy', label: 'Windy' },
  { value: 'other', label: 'Other' },
];

export const PHOTO_CATEGORY_OPTIONS: Option<PhotoCategory>[] = [
  { value: 'progress', label: 'Progress' },
  { value: 'material', label: 'Material' },
  { value: 'issue', label: 'Issue / Defect' },
  { value: 'safety', label: 'Safety' },
  { value: 'completion', label: 'Completion' },
];

// ── Tone mapping for badges ──────────────────────────────────────

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';

export const PROJECT_STATUS_TONES: Record<ProjectStatus, Tone> = {
  planning: 'info',
  active: 'success',
  on_hold: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
};

export const PRIORITY_TONES: Record<TaskPriority, Tone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

export const TASK_STATUS_TONES: Record<TaskStatus, Tone> = {
  todo: 'neutral',
  in_progress: 'info',
  completed: 'success',
  blocked: 'danger',
};

export function optionLabel(options: Option[], value: string | null | undefined): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}

// -- ERP option sets ----------------------------------------------

export const ROLE_OPTIONS: Option[] = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'worker', label: 'Worker' },
];

export const UNIT_STATUS_OPTIONS: Option<UnitStatus>[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'booked', label: 'Booked' },
  { value: 'sold', label: 'Sold' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const UNIT_TYPE_SUGGESTIONS: Option[] = [
  { value: '1 BHK', label: '1 BHK' },
  { value: '2 BHK', label: '2 BHK' },
  { value: '3 BHK', label: '3 BHK' },
  { value: '4 BHK', label: '4 BHK' },
  { value: 'Shop', label: 'Shop' },
  { value: 'Office', label: 'Office' },
  { value: 'Villa', label: 'Villa' },
  { value: 'Plot', label: 'Plot' },
  { value: 'Warehouse', label: 'Warehouse' },
];

export const STRUCTURE_NODE_TYPE_OPTIONS: Option<StructureNodeType>[] = [
  { value: 'phase', label: 'Phase' },
  { value: 'block', label: 'Block / Tower' },
  { value: 'floor', label: 'Floor' },
  { value: 'zone', label: 'Zone' },
  { value: 'area', label: 'Area' },
  { value: 'custom', label: 'Custom level' },
];

export const LEAD_SOURCE_OPTIONS: Option<LeadSourceType>[] = [
  { value: 'website', label: 'Website' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'reference', label: 'Reference' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'broker', label: 'Broker' },
  { value: 'other', label: 'Other' },
];

export const LEAD_STAGE_OPTIONS: Option<LeadStage>[] = [
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'site_visit_scheduled', label: 'Visit Scheduled' },
  { value: 'site_visit_completed', label: 'Visit Completed' },
  { value: 'proposal_sent', label: 'Proposal Shared' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'booked', label: 'Booking Confirmed' },
  { value: 'lost', label: 'Lost' },
];

export const CUSTOMER_STAGE_OPTIONS: Option<CustomerStage>[] = [
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'visit', label: 'Site Visit' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'booking', label: 'Booking' },
  { value: 'payment', label: 'Payment' },
  { value: 'possession', label: 'Possession' },
];

export const BOOKING_STATUS_OPTIONS: Option<BookingStatus>[] = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'sold', label: 'Sold' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const CUSTOMER_PAYMENT_METHOD_OPTIONS: Option<CustomerPaymentMethodType>[] = [
  ...PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== 'other'),
  { value: 'cheque', label: 'Cheque' },
  { value: 'loan', label: 'Loan (Bank)' },
  { value: 'other', label: 'Other' },
] as Option<CustomerPaymentMethodType>[];

export const PAYMENT_TYPE_OPTIONS: Option<PaymentType>[] = [
  { value: 'booking_amount', label: 'Booking Amount' },
  { value: 'installment', label: 'Installment' },
  { value: 'milestone', label: 'Milestone Payment' },
  { value: 'final', label: 'Final Payment' },
];

export const WORK_TYPE_OPTIONS: Option<ContractorWorkType>[] = [
  { value: 'rcc', label: 'RCC' },
  { value: 'brickwork', label: 'Brickwork' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'painting', label: 'Painting' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'interior', label: 'Interior' },
  { value: 'other', label: 'Other' },
];

export const CONTRACT_PAYMENT_TYPE_OPTIONS: Option<ContractorPayment['paymentType']>[] = [
  { value: 'advance', label: 'Advance Payment' },
  { value: 'running_bill', label: 'Running Bill' },
  { value: 'final_settlement', label: 'Final Settlement' },
];

export const PO_STATUS_OPTIONS: Option<PurchaseOrderStatus>[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const EQUIPMENT_TYPE_OPTIONS: Option[] = [
  { value: 'excavator', label: 'Excavator' },
  { value: 'crane', label: 'Crane' },
  { value: 'mixer', label: 'Concrete Mixer' },
  { value: 'lift', label: 'Lift / Hoist' },
  { value: 'generator', label: 'Generator' },
  { value: 'jcb', label: 'JCB' },
  { value: 'tractor', label: 'Tractor / Trolley' },
  { value: 'pump', label: 'Water Pump' },
  { value: 'scaffolding', label: 'Scaffolding' },
  { value: 'other', label: 'Other' },
];

export const EQUIPMENT_STATUS_OPTIONS: Option<Equipment['status']>[] = [
  { value: 'active', label: 'Active' },
  { value: 'idle', label: 'Idle' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'retired', label: 'Retired' },
];

export const DOCUMENT_CATEGORY_OPTIONS: Option[] = [
  { value: 'drawing', label: 'Drawing' },
  { value: 'floor_plan', label: 'Floor Plan' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'noc', label: 'NOC' },
  { value: 'government_approval', label: 'Govt. Approval' },
  { value: 'structural_drawing', label: 'Structural Drawing' },
  { value: 'site_document', label: 'Site Document' },
  { value: 'customer_document', label: 'Customer Document' },
  { value: 'other', label: 'Other' },
];

export const APPROVAL_ENTITY_OPTIONS: Option<ApprovalEntityType>[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'booking', label: 'Booking' },
  { value: 'custom', label: 'Other Request' },
];

export const CONSTRUCTION_STAGE_OPTIONS: Option<StageName>[] = [
  { value: 'excavation', label: 'Excavation' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'rcc_structure', label: 'RCC Structure' },
  { value: 'brickwork', label: 'Brickwork' },
  { value: 'plaster', label: 'Plaster' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'painting', label: 'Painting' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'handover', label: 'Handover' },
];

export const STAGE_STATUS_OPTIONS: Option<StageStatus>[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

export const REPORT_TYPE_OPTIONS: Option[] = [
  { value: 'project', label: 'Project Report' },
  { value: 'sales', label: 'Sales Report' },
  { value: 'booking', label: 'Booking Report' },
  { value: 'payment', label: 'Payment Report' },
  { value: 'progress', label: 'Progress Report' },
  { value: 'vendor', label: 'Vendor Report' },
  { value: 'contractor', label: 'Contractor Report' },
  { value: 'attendance', label: 'Attendance Report' },
  { value: 'expense', label: 'Expense Report' },
  { value: 'inventory', label: 'Inventory Report' },
];
