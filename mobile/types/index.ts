// ── API envelope ─────────────────────────────────────────────────
export interface ApiErrorItem {
  field?: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
  errors?: ApiErrorItem[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Domain models (mirror server responses) ──────────────────────

export type UserRole =
  | 'super_admin'
  | 'owner'
  | 'admin'
  | 'project_manager'
  | 'site_engineer'
  | 'accountant'
  | 'sales_manager'
  | 'sales_executive'
  | 'receptionist'
  | 'supervisor'
  | 'manager'
  | 'engineer'
  | 'worker';

export const PERMISSION_KEYS = [
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
  // Property ERP specific
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
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar: string | null;
  companyId: string | Company | null;
  assignedProjects: Project[] | string[];
  isActive: boolean;
  permissions?: PermissionKey[];
}

export interface Company {
  _id: string;
  name: string;
  ownerId: string;
  phone?: string;
  email?: string;
  address?: string;
  logo: string | null;
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectType = 'residential' | 'commercial' | 'industrial' | 'renovation' | 'infrastructure' | 'interior' | 'other';

export interface Project {
  _id: string;
  companyId: string;
  name: string;
  projectCode: string;
  clientName?: string;
  clientPhone?: string;
  location?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  siteRadiusMeters?: number;
  projectType: ProjectType;
  startDate: string;
  expectedEndDate?: string;
  budget: number;
  spentAmount: number;
  status: ProjectStatus;
  progressPercentage: number;
  description?: string;
  projectManagerId?: { _id: string; name: string; phone?: string } | null;
  remainingBudget?: number;
  budgetUtilization?: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkerType =
  | 'mason' | 'helper' | 'electrician' | 'plumber' | 'carpenter'
  | 'painter' | 'welder' | 'operator' | 'other';

export type WorkerStatus = 'active' | 'inactive' | 'terminated';

export interface Worker {
  _id: string;
  companyId: string;
  name: string;
  phone?: string;
  workerType: WorkerType;
  dailyWage: number;
  skill?: string;
  projectId: string | Pick<Project, '_id' | 'name' | 'location'> | null;
  joiningDate: string;
  status: WorkerStatus;
  profilePhoto: string | null;
  contactId?: string | null;
}

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface AttendanceRecord {
  _id: string;
  projectId: string;
  workerId:
    | string
    | Pick<Worker, '_id' | 'name' | 'workerType' | 'dailyWage' | 'profilePhoto'>;
  date: string; // YYYY-MM-DD from server serializer
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  overtimeHours: number;
  remarks?: string;
  geo?: {
    latitude: number;
    longitude: number;
    distanceMeters?: number | null;
  } | null;
  markedBy: string;
}

export type MaterialCategory =
  | 'cement' | 'steel' | 'sand' | 'aggregate' | 'bricks' | 'tiles'
  | 'plumbing' | 'electrical' | 'paint' | 'hardware' | 'other';

export type MaterialUnit =
  | 'bag' | 'kg' | 'quintal' | 'ton' | 'brass' | 'cft' | 'sqft' | 'litre'
  | 'meter' | 'roll' | 'piece' | 'packet' | 'box' | 'trip' | 'other';

export interface Material {
  _id: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  currentStock: number;
  minimumStock: number;
  averagePrice: number;
  supplier?: string;
  lastRestockedAt: string | null;
  isLowStock?: boolean;
  estimatedValue?: number;
}

export type TransactionType = 'purchase' | 'usage' | 'adjustment' | 'return';

export interface MaterialTransaction {
  _id: string;
  materialId: string | Pick<Material, '_id' | 'name' | 'unit'>;
  projectId: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  supplier?: string;
  invoiceNumber?: string;
  date: string;
  notes?: string;
  createdBy?: { _id: string; name: string } | string;
}

export type ExpenseCategory =
  | 'materials' | 'labor' | 'transportation' | 'equipment' | 'electricity'
  | 'permits' | 'food' | 'maintenance' | 'miscellaneous';

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';

export interface Expense {
  _id: string;
  projectId: string | Pick<Project, '_id' | 'name' | 'location'>;
  category: ExpenseCategory;
  title: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  description?: string;
  receiptImage?: { url: string | null; publicId: string | null };
  createdBy?: { _id: string; name: string; role?: string } | string;
  createdAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked';

export interface Task {
  _id: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  title: string;
  description?: string;
  assignedTo: { _id: string; name: string; role?: string } | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt?: string | null;
  createdBy?: { _id: string; name: string } | string;
}

export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'humid' | 'windy' | 'other';

export interface DailyReport {
  _id: string;
  projectId: string | Pick<Project, '_id' | 'name' | 'location'>;
  date: string;
  weather: Weather;
  summary?: string;
  workCompleted?: string;
  workersPresent: number;
  materialsUsed?: string;
  issues?: string;
  safetyNotes?: string;
  tomorrowPlan?: string;
  photos: string[];
  videos?: string[];
  createdBy?: { _id: string; name: string; role?: string } | string;
}

export type PhotoCategory = 'progress' | 'material' | 'issue' | 'safety' | 'completion';

export type MediaKind = 'image' | 'video' | 'document';

export interface SiteMedia {
  _id: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  url: string;
  publicId: string | null;
  kind: MediaKind;
  mimeType: string | null;
  durationSeconds: number | null;
  category: PhotoCategory;
  description?: string;
  uploadedBy?: { _id: string; name: string } | string;
  sizeBytes?: number | null;
  createdAt: string;
}

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

export interface AppNotification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  relatedProjectId?: { _id: string; name: string } | null;
  createdAt: string;
}

// ── Dashboard payloads ───────────────────────────────────────────

export interface DashboardMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  budgetUtilization: number;
  totalWorkers: number;
  workersPresentToday: number;
  lowStockCount: number;
  overdueTasks: number;
  todaysExpenses: number;
  todaysExpenseCount: number;
  monthExpenses: number;
  overallProgress: number;
}

export interface DashboardProjectCard {
  _id: string;
  name: string;
  clientName?: string;
  location?: string;
  status: ProjectStatus;
  progressPercentage: number;
  budget: number;
  spentAmount: number;
  startDate: string;
  expectedEndDate?: string;
  daysRemaining: number | null;
  overBudget: boolean;
}

export interface TodaysActivity {
  workersPresent: number;
  workersAbsent: number;
  workersOnLeave: number;
  expensesToday: number;
  materialDeliveries: number;
  tasksDueToday: number;
}

export interface ActivityItem {
  kind: 'expense' | 'attendance' | 'material' | 'task' | 'report';
  id: string;
  title: string;
  subtitle?: string;
  projectId?: string | { _id: string; name: string };
  timestamp: string;
  createdAt?: string;
}

export interface GlobalDashboard {
  scope: 'company' | 'project';
  metrics: DashboardMetrics;
  projects: DashboardProjectCard[];
  todaysActivity: TodaysActivity;
  recentExpenses: Expense[];
  lowStockMaterials: (Material & { projectId: Pick<Project, '_id' | 'name'> })[];
  recentActivity: ActivityItem[];
}

export interface ProjectDashboard {
  project: Project;
  financial: {
    budget: number;
    spent: number;
    remaining: number;
    utilization: number;
    overBudget: boolean;
    overBy: number;
  };
  workforce: {
    totalWorkers: number;
    present: number;
    halfDay: number;
    absent: number;
    leave: number;
    unmarked: number;
    estimatedLaborCost: number;
  };
  materials: {
    lowStockNames: string[];
    lowStockCount: number;
  };
  tasks: {
    open: number;
    overdue: number;
    completed: number;
  };
  recentActivity: ActivityItem[];
}

export interface ExpenseAnalytics {
  periodMonth: string | null;
  totalSpent: number;
  totalCount: number;
  todayTotal: number;
  monthTotal: number;
  byCategory: { _id: ExpenseCategory; total: number; count: number }[];
  byPaymentMethod: { _id: PaymentMethod; total: number; count: number }[];
}

export interface MaterialListResponse {
  materials: Material[];
  summary: {
    count: number;
    lowStockCount: number;
    estimatedValue: number;
  };
}

export interface WorkerDetail {
  worker: Worker;
  attendanceHistory: AttendanceRecord[];
  thisMonth: {
    present: number;
    absent: number;
    halfDay: number;
    leave: number;
    estimatedSalary: number;
  };
}

export interface MaterialDetail {
  material: Material;
  transactions: MaterialTransaction[];
}

// -- ERP expansion models -----------------------------------------

export type UnitStatus = 'available' | 'reserved' | 'booked' | 'sold' | 'blocked' | 'cancelled';

export interface Unit {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  phaseId?: string | { _id: string; name: string } | null;
  blockId?: string | { _id: string; name: string } | null;
  towerId?: string | { _id: string; name: string } | null;
  floorId?: string | { _id: string; name: string } | null;
  category?: 'flat' | 'shop' | 'office' | 'penthouse' | 'plot';
  unitNumber: string;
  unitType: string;
  areaSqft: number;
  carpetAreaSqmt?: number | null;
  carpetAreaSqft: number;
  builtUpAreaSqmt?: number | null;
  builtUpAreaSqft?: number;
  plotAreaSqmt?: number | null;
  balconyAreaSqmt?: number | null;
  terraceAreaSqmt?: number | null;
  saleDeedAmount?: number | null;
  superBuiltupAreaSqft: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  balconies?: number;
  floorNumber?: number;
  facing?: string | null;
  ratePerSqft: number;
  basePrice?: number;
  parkingSlot?: string | null;
  parkingCharges?: number;
  clubhouseCharges?: number;
  gstPercentage?: number;
  gstAmount?: number;
  finalPrice?: number;
  totalValue: number;
  status: UnitStatus;
  currentCustomerId?: { _id: string; name: string; phone?: string } | string | null;
  currentBookingId?: { _id: string; bookingNumber: string; status: string } | string | null;
  notes?: string;
}

export interface InventorySummary {
  totalUnits: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
  blocked: number;
  cancelled: number;
  soldValue: number;
  unsoldInventoryValue: number;
  potentialRevenue: number;
  revenueCollected: number;
  byType: { unitType: string; count: number; available: number }[];
}

export type StructureNodeType =
  | 'phase' | 'block' | 'floor' | 'unit' | 'zone' | 'area' | 'custom';

export interface StructureNode {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  parentId: string | null;
  nodeType: StructureNodeType;
  customType?: string | null;
  name: string;
  order: number;
  description?: string;
  progressPercentage: number;
}

export type CustomerStage = 'inquiry' | 'visit' | 'negotiation' | 'booking' | 'payment' | 'possession';
export type LeadSourceType =
  | 'website' | 'walk_in' | 'reference' | 'facebook' | 'instagram' | 'broker' | 'other';

export interface CustomerTimelineEvent {
  stage: CustomerStage;
  note?: string;
  date: string;
}

export interface Customer {
  _id: string;
  companyId: string;
  projectId?: string | Pick<Project, '_id' | 'name'> | null;
  name: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pan?: string | null;
  aadhaar?: string | null;
  gstNumber?: string | null;
  occupation?: string | null;
  photoUrl?: string | null;
  leadSource: LeadSourceType;
  journeyStage: CustomerStage;
  timeline: CustomerTimelineEvent[];
  nominee?: {
    name?: string;
    relation?: string;
    age?: number;
    phone?: string;
    aadhaar?: string;
  };
  documents?: {
    title: string;
    documentType?: string;
    url: string;
    uploadedAt?: string;
  }[];
  assignedTo?: { _id: string; name: string; role?: string } | string | null;
  isActive?: boolean;
}

export interface CustomerDetail {
  customer: Customer;
  bookings: (Booking & { unitId?: Pick<Unit, '_id' | 'unitNumber' | 'unitType'> })[];
}

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'site_visit_scheduled'
  | 'site_visit_completed'
  | 'proposal_sent'
  | 'negotiation'
  | 'booked'
  | 'lost';

export interface LeadFollowUp {
  _id?: string;
  date: string;
  note?: string;
  done: boolean;
}

export interface LeadNote {
  text: string;
  author?: { _id: string; name: string } | string;
  createdAt: string;
}

export interface Lead {
  _id: string;
  companyId: string;
  projectId?: string | Pick<Project, '_id' | 'name'> | null;
  name: string;
  phone: string;
  email?: string | null;
  source: LeadSourceType;
  stage: LeadStage;
  interestedIn?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  assignedTo?: { _id: string; name: string; role?: string } | string | null;
  customerId?: { _id: string; name: string } | string | null;
  bookingId?: { _id: string; bookingNumber: string; status: string } | string | null;
  followUps: LeadFollowUp[];
  nextFollowUpDate?: string | null;
  notes: LeadNote[];
  lostReason?: string | null;
  convertedValue?: number | null;
}

export interface SalesDashboard {
  openLeads: number;
  leadsThisMonth: number;
  conversionsThisMonth: number;
  totalConversions: number;
  lostThisMonth: number;
  revenueBooked: number;
  conversionRate: number;
  byStage: { stage: LeadStage; count: number }[];
  topSources: { source: LeadSourceType; count: number; won: number }[];
  upcomingFollowUps: Lead[];
}

export interface BookingScheduleItem {
  installmentNo: number;
  title: string;
  percentage?: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
  paidAmount: number;
  paymentId?: string | null;
}

export type BookingStatus = 'draft' | 'pending' | 'confirmed' | 'registered' | 'sold' | 'cancelled' | 'completed';

export interface Booking {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  unitId: string | Pick<Unit, '_id' | 'unitNumber' | 'unitType' | 'totalValue'>;
  customerId: string | Pick<Customer, '_id' | 'name' | 'phone'>;
  bookingNumber: string;
  bookingDate: string;
  bookingAmount: number;
  basePrice?: number;
  discountAmount?: number;
  discountReason?: string | null;
  finalPrice?: number;
  totalValue: number;
  salesManagerId?: { _id: string; name: string } | string | null;
  salesExecutiveId?: { _id: string; name: string } | string | null;
  remarks?: string | null;
  status: BookingStatus;
  paymentSchedule?: BookingScheduleItem[];
  banakhatDocumentId?: string | null;
  dastavejDocumentId?: string | null;
  possessionDate?: string | null;
  cancellationReason?: string | null;
  notes?: string;
  paidAmount?: number;
  outstanding?: number;
  paymentCount?: number;
}

export type PaymentType = 'booking_amount' | 'installment' | 'milestone' | 'final';
export type CustomerPaymentMethodType =
  | 'cash' | 'upi' | 'bank_transfer' | 'card' | 'cheque' | 'loan' | 'neft' | 'rtgs' | 'other';
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';

export interface Payment {
  _id: string;
  companyId: string;
  projectId?: string | Pick<Project, '_id' | 'name'> | null;
  bookingId?: string | { _id: string; bookingNumber: string; status: string } | null;
  customerId: string | Pick<Customer, '_id' | 'name' | 'phone'>;
  unitId?: string | Pick<Unit, '_id' | 'unitNumber'> | null;
  paymentNumber: string;
  receiptNumber?: string | null;
  amount: number;
  paymentType: PaymentType;
  method: CustomerPaymentMethodType;
  mode?: string;
  transactionId?: string | null;
  bankName?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  installmentNo?: number | null;
  dueDate?: string | null;
  paidDate?: string | null;
  status: PaymentStatus;
  reference?: string | null;
  receiptPdfUrl?: string | null;
  notes?: string;
  isOverdue?: boolean;
}

export interface ReceivablesDashboard {
  totalReceivable: number;
  pendingCount: number;
  overdueAmount: number;
  overdueCount: number;
  upcoming: (Payment & { daysUntilDue: number })[];
  customerWise: {
    customer?: Pick<Customer, '_id' | 'name' | 'phone'>;
    outstanding: number;
    overdue: number;
    count: number;
  }[];
}

export type ContractorWorkType =
  | 'rcc' | 'brickwork' | 'plumbing' | 'electrical' | 'painting' | 'flooring' | 'interior' | 'other';

export interface Contractor {
  _id: string;
  companyId: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  workTypes: ContractorWorkType[];
  specialty?: string | null;
  gstNumber?: string | null;
  isActive?: boolean;
  contractCount?: number;
  totalContractValue?: number;
  paidAmount?: number;
  pendingAmount?: number;
}

export interface ContractorContract {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  contractorId: string | Pick<Contractor, '_id' | 'name'>;
  scope: string;
  contractValue: number;
  paidAmount: number;
  startDate?: string | null;
  endDate?: string | null;
  status: 'active' | 'completed' | 'terminated';
  notes?: string;
  pendingAmount?: number;
}

export interface ContractorPayment {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  contractId: string;
  contractorId: string;
  paymentType: 'advance' | 'running_bill' | 'final_settlement';
  amount: number;
  date: string;
  method: string;
  reference?: string | null;
  notes?: string;
}

export interface Vendor {
  _id: string;
  companyId: string;
  name: string;
  companyName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  materialsSupplied: string[];
  isActive?: boolean;
  orderCount?: number;
  deliveredCount?: number;
  totalOrderValue?: number;
}

export type PurchaseOrderStatus =
  | 'draft' | 'approved' | 'ordered' | 'delivered' | 'closed' | 'cancelled';

export interface PurchaseOrderItem {
  materialName: string;
  category?: string | null;
  quantity: number;
  unit?: string | null;
  rate: number;
  amount: number;
}

export interface PurchaseOrder {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  vendorId: string | Pick<Vendor, '_id' | 'name' | 'companyName'>;
  poNumber: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  paidAmount: number;
  outstanding?: number;
  status: PurchaseOrderStatus;
  expectedDeliveryDate?: string | null;
  orderedAt?: string | null;
  deliveredAt?: string | null;
  closedAt?: string | null;
  invoiceNumber?: string | null;
  notes?: string;
  requestedBy?: { _id: string; name: string } | string;
  approvedBy?: { _id: string; name: string } | string | null;
  createdAt: string;
}

export interface EquipmentUsageEntry {
  _id?: string;
  date: string;
  hoursUsed: number;
  fuelCost: number;
  maintenanceCost: number;
  note?: string;
}

export interface Equipment {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'> | null;
  equipmentNumber: string;
  name: string;
  type: string;
  ownership: 'owned' | 'rented';
  purchaseCost: number;
  rentalCostPerDay: number;
  fuelCostTotal: number;
  maintenanceCostTotal: number;
  operatingHours: number;
  purchaseDate?: string | null;
  status: 'active' | 'idle' | 'maintenance' | 'retired';
  notes?: string;
  utilizationPercent?: number;
}

export interface DocumentFile {
  _id: string;
  companyId: string;
  projectId?: string | Pick<Project, '_id' | 'name'> | null;
  customerId?: string | Pick<Customer, '_id' | 'name'> | null;
  title: string;
  category: string;
  url: string;
  publicId?: string | null;
  mimeType?: string | null;
  kind: 'image' | 'video' | 'document';
  sizeBytes?: number | null;
  expiryDate?: string | null;
  notes?: string;
  uploadedBy?: { _id: string; name: string } | string;
  createdAt: string;
}

export type ApprovalEntityType = 'expense' | 'purchase_order' | 'booking' | 'custom';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface ApprovalStep {
  level: number;
  role: UserRole;
  label?: string;
  status: ApprovalStepStatus;
  actedBy?: { _id: string; name: string } | string | null;
  actedAt?: string | null;
  comment?: string | null;
}

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface Approval {
  _id: string;
  companyId: string;
  projectId?: string | Pick<Project, '_id' | 'name'> | null;
  entityType: ApprovalEntityType;
  entityId?: string | null;
  title: string;
  amount?: number | null;
  requestedBy?: { _id: string; name: string; role?: string } | string;
  steps: ApprovalStep[];
  currentLevel: number;
  status: ApprovalStatus;
  completedAt?: string | null;
  canAct?: boolean;
  currentStep?: ApprovalStep;
}

export interface Milestone {
  _id: string;
  companyId: string;
  projectId: string | Pick<Project, '_id' | 'name'>;
  name: string;
  description?: string | null;
  dueDate: string;
  completedAt?: string | null;
  status: 'upcoming' | 'completed' | 'delayed';
  effectiveStatus?: 'upcoming' | 'completed' | 'delayed';
  daysOverdue?: number | null;
  daysUntilDue?: number | null;
}

export type StageName =
  | 'excavation' | 'foundation' | 'rcc_structure' | 'brickwork' | 'plaster'
  | 'electrical' | 'plumbing' | 'flooring' | 'painting' | 'finishing'
  | 'landscaping' | 'handover' | 'custom';
export type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';

export interface ConstructionStage {
  _id: string;
  companyId: string;
  projectId: string;
  name: StageName;
  customName?: string | null;
  order: number;
  label?: string;
  startDate?: string | null;
  endDate?: string | null;
  status: StageStatus;
  progressPercentage: number;
  notes?: string;
  isDelayed?: boolean;
}

export interface WorkItem {
  _id: string;
  companyId: string;
  projectId: string;
  nodeId?: string | Pick<StructureNode, '_id' | 'name' | 'nodeType'> | null;
  name: string;
  stageName?: StageName | null;
  progressPercentage: number;
  startDate?: string | null;
  endDate?: string | null;
  status: StageStatus;
  notes?: string;
}

export interface ProgressNode {
  _id: string;
  nodeType: string;
  customType?: string | null;
  name: string;
  progressPercentage: number;
  children: ProgressNode[];
  workItems: WorkItem[];
}

export interface ProgressDashboard {
  project: Pick<Project, '_id' | 'name' | 'progressPercentage' | 'startDate' | 'expectedEndDate'>;
  blocks: ProgressNode[];
  stages: ConstructionStage[];
  milestones: Milestone[];
}

// -- Analytics payloads -------------------------------------------

export interface FinancialAnalytics {
  period: { from: string; to: string };
  revenue: number;
  expenses: number;
  grossProfitability: number;
  margin: number;
  totalBudget: number;
  totalSpent: number;
  budgetUtilization: number;
  receivables: { pendingAmount: number; pendingCount: number; overdueAmount: number; overdueCount: number };
  payables: { purchaseOrders: number; poCount: number; contractors: number };
  cashFlow: { month: string; label: string; inflow: number; outflow: number; net: number }[];
  expenseBreakdown: { category: string; total: number; count: number }[];
  collectionsByMethod: { method: string; total: number; count: number }[];
  projects: {
    _id: string;
    name: string;
    status: ProjectStatus;
    budget: number;
    spent: number;
    utilization: number;
    profitability: number;
  }[];
}

export interface ExecutiveDashboard {
  projects: {
    total: number;
    active: number;
    completed: number;
    avgProgress: number;
    list: {
      _id: string;
      name: string;
      status: ProjectStatus;
      progressPercentage: number;
      budget: number;
      spent: number;
      overBudget: boolean;
    }[];
  };
  finance: {
    revenueCollected: number;
    totalBudget: number;
    totalSpent: number;
    budgetUtilization: number;
    profitability: number;
  };
  sales: {
    bookingsThisMonth: number;
    activeBookings: number;
    bookedValue: number;
    units: {
      available: number;
      reserved: number;
      booked: number;
      sold: number;
      unsoldInventoryValue: number;
    };
  };
  receivables: { pending: number; overdue: number; overdueCount: number };
  payables: { purchaseOrders: number; contractors: number };
  milestones: {
    delayed: { _id: string; name: string; dueDate: string; projectName?: string }[];
    upcoming: { _id: string; name: string; dueDate: string; projectName?: string }[];
  };
  alerts: {
    lowStockCount: number;
    pendingApprovals: number;
    longOverduePayments: { _id: string; amount: number; dueDate: string; customerName: string }[];
  };
}

export interface AuditLogEntry {
  _id: string;
  companyId?: string;
  userId?: string | { _id: string; name: string } | null;
  userName?: string;
  userRole?: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  description: string;
  createdAt: string;
}

// -- Report payloads ----------------------------------------------

export interface ReportEnvelope<T = any> {
  type: string;
  generatedAt: string;
  period?: { from: string | Date; to: string | Date };
  rows?: any[];
  totals?: Record<string, number>;
  [key: string]: any;
}

// ── Property ERP models ──────────────────────────────────────────

export interface PropertyProject extends Project {
  builderName?: string;
  reraNumber?: string;
  launchDate?: string | null;
  completionDate?: string | null;
  totalTowers?: number;
  totalUnits?: number;
  amenities?: string[];
  towersCount?: number;
  inventoryStats?: {
    available: number;
    booked: number;
    sold: number;
    total: number;
  };
}

export interface PropertyTower {
  _id: string;
  companyId?: string;
  projectId: string;
  name: string;
  towerNumber?: string;
  nodeType?: string;
  description?: string;
  floorsCount?: number;
  totalFloors?: number;
  totalUnits?: number;
  category?: string;
  unitsCount?: {
    total: number;
    available: number;
    booked: number;
    sold: number;
  };
  createdAt?: string;
}

export interface PropertyFloor {
  _id: string;
  companyId?: string;
  projectId: string;
  parentId?: string; // towerId
  towerId?: string;
  floorNumber?: string | number;
  name: string;
  order?: number;
  orderIndex?: number;
  totalUnits?: number;
  description?: string;
  unitsCount?: {
    total: number;
    available: number;
    booked: number;
    sold: number;
  };
}

export interface PropertyUnit extends Unit {
  towerName?: string;
  floorName?: string;
}

export interface PropertyCustomer extends Customer {
  panNumber?: string;
  aadhaarNumber?: string;
  stage?: string;
}

export type PropertyBooking = Booking & {
  payments?: PropertyPayment[];
  summary?: any;
};
export type PropertyPayment = Payment;

export interface Customer360Response {
  customer: PropertyCustomer;
  bookings: PropertyBooking[];
  financials: {
    totalBilled: number;
    totalPaid: number;
    balanceDue: number;
  };
  receipts: PropertyPayment[];
  documents: PropertyDocumentItem[];
}

export interface PropertyDocumentItem {
  _id: string;
  companyId?: string;
  projectId?: string | { _id: string; name: string };
  bookingId?: string | { _id: string; bookingNumber: string } | null;
  customerId?: string | { _id: string; name: string; phone?: string };
  unitId?: string | { _id: string; unitNumber: string } | null;
  documentType: 'receipt' | 'banakhat' | 'dastavej' | 'booking_confirmation' | 'demand_letter';
  documentNumber: string;
  title: string;
  renderedContent?: string | null;
  pdfUrl?: string | null;
  status: 'draft' | 'generated' | 'signed' | 'registered';
  registrationDetails?: {
    registrationNumber?: string;
    registrationDate?: string;
    subRegistrarOffice?: string;
    stampDutyPaid?: number;
    registrationFee?: number;
  };
  createdAt: string;
}

export interface PropertyDocumentTemplate {
  _id: string;
  companyId: string;
  templateType: 'receipt' | 'banakhat' | 'dastavej' | 'booking_confirmation' | 'demand_letter';
  title: string;
  headerHtml?: string | null;
  bodyContent: string;
  footerHtml?: string | null;
  termsAndConditions?: string[];
  isDefault: boolean;
}

export interface PropertyDashboardStats {
  totalUnits?: number;
  availableUnits?: number;
  bookedUnits?: number;
  soldUnits?: number;
  financials?: {
    totalSalesValue?: number;
    totalCollected?: number;
    totalOutstanding?: number;
  };
  inventory: {
    totalUnits: number;
    availableUnits: number;
    bookedUnits: number;
    soldUnits: number;
    availableValue: number;
    bookedValue: number;
    soldValue: number;
  };
  collections: {
    today: number;
    todayCount: number;
    monthly: number;
    monthlyCount: number;
    pending: number;
    pendingCount: number;
    overdue: number;
    overdueCount: number;
  };
  recentBookings: (Booking & {
    customerId?: { name: string; phone: string };
    projectId?: { name: string };
    unitId?: { unitNumber: string; unitType: string };
  })[];
  recentReceipts: (Payment & {
    customerId?: { name: string };
    unitId?: { unitNumber: string };
  })[];
  projectRevenue: {
    projectId: string;
    projectName: string;
    projectCode: string;
    bookedValue: number;
    bookingsCount: number;
  }[];
}

export interface ExcelImportPreview {
  totalRows: number;
  validRows: any;
  errorRows: number;
  validCount?: number;
  errorCount?: number;
  duplicateCount?: number;
  errors: {
    rowNumber?: number;
    unitNumber?: string;
    projectName?: string;
    reason?: string;
    message?: string;
  }[];
  rows?: any[];
}





