import { api, cachedGet, mutateWithOfflineQueue } from './api';
import type {
  ApiResponse,
  Approval,
  ApprovalStatus,
  Booking,
  ConstructionStage,
  Contractor,
  ContractorContract,
  ContractorPayment,
  Customer,
  CustomerDetail,
  DocumentFile,
  Equipment,
  ExecutiveDashboard,
  FinancialAnalytics,
  InventorySummary,
  Lead,
  LeadStage,
  Milestone,
  Pagination,
  Payment,
  PaymentStatus,
  ProgressDashboard,
  PurchaseOrder,
  PurchaseOrderStatus,
  ReceivablesDashboard,
  ReportEnvelope,
  SalesDashboard,
  StructureNode,
  Unit,
  UnitStatus,
  Vendor,
} from '@/types';

interface Paged<T> {
  items: T[];
  pagination: Pagination;
}

function params(filters: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

async function getPaged<T>(url: string, query: Record<string, unknown>): Promise<Paged<T>> {
  try {
    const res = await api.get<ApiResponse<T[]>>(url, { params: query });
    return { items: res.data.data, pagination: res.data.pagination! };
  } catch (err) {
    const cached = await cachedGet<T[]>(url, { ...query, page: 1 });
    if (Array.isArray(cached)) {
      return {
        items: cached,
        pagination: { page: 1, limit: cached.length, total: cached.length, totalPages: 1 },
      };
    }
    throw err;
  }
}

// ── Project structure ────────────────────────────────────────────

export const structureService = {
  list: (filters: { projectId?: string; nodeType?: string; parentId?: string } = {}) =>
    cachedGet<StructureNode[]>('/units/structure', params({ limit: 500, ...filters })),
  getTree: (projectId: string) =>
    cachedGet<{ projectId: string; tree: any[] }>('/units/structure/tree', { projectId }),
  createNode: (input: Partial<StructureNode> & { projectId: string; name: string }) =>
    mutateWithOfflineQueue<StructureNode>(
      { method: 'POST', url: '/units/structure', data: input },
      'Structure level',
    ),
  updateNode: (id: string, input: Partial<StructureNode>) =>
    mutateWithOfflineQueue<StructureNode>(
      { method: 'PUT', url: `/units/structure/${id}`, data: input },
      'Structure level',
    ),
  deleteNode: async (id: string) => {
    await api.delete(`/units/structure/${id}`);
  },
};

// ── Units / inventory ────────────────────────────────────────────

export const unitService = {
  list: (filters: {
    projectId?: string | null;
    status?: UnitStatus | '';
    unitType?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    getPaged<Unit>('/units', params({
      projectId: filters.projectId ?? undefined,
      status: filters.status || undefined,
      unitType: filters.unitType || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    })),
  get: async (id: string) => {
    const res = await api.get<ApiResponse<Unit>>(`/units/${id}`);
    return res.data.data;
  },
  summary: (projectId?: string | null) =>
    cachedGet<InventorySummary>(
      '/units/inventory-summary',
      params({ projectId: projectId ?? undefined }),
    ),
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Unit>({ method: 'POST', url: '/units', data: input }, 'Unit'),
  update: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Unit>({ method: 'PUT', url: `/units/${id}`, data: input }, 'Unit'),
  remove: async (id: string) => {
    await api.delete(`/units/${id}`);
  },
};

// ── Customers ────────────────────────────────────────────────────

export const customerService = {
  list: (filters: {
    projectId?: string | null;
    journeyStage?: string;
    leadSource?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    getPaged<Customer>('/customers', params({
      projectId: filters.projectId ?? undefined,
      journeyStage: filters.journeyStage || undefined,
      leadSource: filters.leadSource || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    })),
  get: async (id: string): Promise<CustomerDetail> => {
    try {
      const res = await api.get<ApiResponse<CustomerDetail>>(`/customers/${id}`);
      return res.data.data;
    } catch (err) {
      const cached = await cachedGet<any>(`/customers/${id}`, {});
      if (cached) return cached as CustomerDetail;
      throw err;
    }
  },
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Customer>({ method: 'POST', url: '/customers', data: input }, 'Customer'),
  update: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Customer>({ method: 'PUT', url: `/customers/${id}`, data: input }, 'Customer'),
  addTimeline: (id: string, stage: string, note?: string) =>
    mutateWithOfflineQueue<Customer>(
      { method: 'POST', url: `/customers/${id}/timeline`, data: { stage, note } },
      'Timeline',
    ),
};

// ── Leads ────────────────────────────────────────────────────────

export const leadService = {
  list: (filters: {
    projectId?: string | null;
    stage?: LeadStage | '';
    source?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    getPaged<Lead>('/leads', params({
      projectId: filters.projectId ?? undefined,
      stage: filters.stage || undefined,
      source: filters.source || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    })),
  get: async (id: string): Promise<Lead> => {
    try {
      const res = await api.get<ApiResponse<Lead>>(`/leads/${id}`);
      return res.data.data;
    } catch (err) {
      const cached = await cachedGet<Lead>(`/leads/${id}`, {});
      if (cached) return cached;
      throw err;
    }
  },
  dashboard: (projectId?: string | null) =>
    cachedGet<SalesDashboard>(
      '/leads/sales-dashboard',
      params({ projectId: projectId ?? undefined }),
    ),
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Lead>({ method: 'POST', url: '/leads', data: input }, 'Lead'),
  update: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Lead>({ method: 'PUT', url: `/leads/${id}`, data: input }, 'Lead'),
  scheduleFollowUp: (id: string, date: string, note?: string) =>
    mutateWithOfflineQueue<Lead>(
      { method: 'POST', url: `/leads/${id}/follow-ups`, data: { date, note } },
      'Follow-up',
    ),
  completeFollowUp: async (id: string, index?: number) => {
    await api.post(`/leads/${id}/follow-ups/${index ?? ''}complete`);
  },
  convert: (id: string, customerId: string) =>
    mutateWithOfflineQueue<Lead>(
      { method: 'POST', url: `/leads/${id}/convert`, data: { customerId } },
      'Conversion',
    ),
};

// ── Bookings & payments ──────────────────────────────────────────

export const bookingService = {
  list: (filters: {
    projectId?: string | null;
    status?: Booking['status'] | '';
    customerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    getPaged<Booking>('/bookings', params({
      projectId: filters.projectId ?? undefined,
      status: filters.status || undefined,
      customerId: filters.customerId || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    })),
  get: async (
    id: string,
  ): Promise<{
    booking: Booking;
    payments: Payment[];
    summary: { totalValue: number; paidAmount: number; outstanding: number; overdueAmount: number };
  }> => {
    try {
      const res = await api.get<ApiResponse<any>>(`/bookings/${id}`);
      return res.data.data;
    } catch (err) {
      const cached = await cachedGet<any>(`/bookings/${id}`, {});
      if (cached) return cached;
      throw err;
    }
  },
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Booking>({ method: 'POST', url: '/bookings', data: input }, 'Booking'),
  action: (id: string, action: string, extra: Record<string, unknown> = {}) =>
    mutateWithOfflineQueue<Booking>(
      { method: 'POST', url: `/bookings/${id}/actions`, data: { action, ...extra } },
      'Booking',
    ),
  generateSchedule: (id: string, installments: number, startDate: string, frequencyMonths = 1) =>
    mutateWithOfflineQueue<Payment[]>(
      {
        method: 'POST',
        url: `/bookings/${id}/schedule`,
        data: { installments, startDate, frequencyMonths },
      },
      'Payment plan',
    ),
};

export const paymentService = {
  list: (filters: {
    projectId?: string | null;
    status?: PaymentStatus | '';
    overdue?: boolean;
    customerId?: string;
    bookingId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    getPaged<Payment>('/payments', params({
      projectId: filters.projectId ?? undefined,
      status: filters.status || undefined,
      overdue: filters.overdue ? 'true' : undefined,
      customerId: filters.customerId || undefined,
      bookingId: filters.bookingId || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    })),
  receivables: (projectId?: string | null) =>
    cachedGet<ReceivablesDashboard>(
      '/payments/receivables',
      params({ projectId: projectId ?? undefined }),
    ),
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Payment>({ method: 'POST', url: '/payments', data: input }, 'Payment'),
  markPaid: (id: string, extra: Record<string, unknown> = {}) =>
    mutateWithOfflineQueue<Payment>(
      { method: 'POST', url: `/payments/${id}/mark-paid`, data: extra },
      'Payment',
    ),
};

// ── Contractors ──────────────────────────────────────────────────

export const contractorService = {
  list: (filters: { workType?: string; search?: string; page?: number } = {}) =>
    getPaged<Contractor>('/contractors', params({
      workType: filters.workType || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: 20,
    })),
  get: async (id: string): Promise<{ contractor: Contractor; contracts: ContractorContract[]; payments: ContractorPayment[] }> => {
    try {
      const res = await api.get<ApiResponse<any>>(`/contractors/${id}`);
      return res.data.data;
    } catch (err) {
      const cached = await cachedGet<any>(`/contractors/${id}`, {});
      if (cached) return cached;
      throw err;
    }
  },
  outstanding: () => cachedGet<any[]>('/contractors/outstanding', {}),
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Contractor>({ method: 'POST', url: '/contractors', data: input }, 'Contractor'),
  update: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Contractor>({ method: 'PUT', url: `/contractors/${id}`, data: input }, 'Contractor'),
  createContract: (contractorId: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<ContractorContract>(
      { method: 'POST', url: `/contractors/${contractorId}/contracts`, data: input },
      'Contract',
    ),
  payContract: (contractorId: string, contractId: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<ContractorPayment>(
      {
        method: 'POST',
        url: `/contractors/${contractorId}/contracts/${contractId}/payments`,
        data: input,
      },
      'Contract payment',
    ),
};

// ── Vendors & purchase orders ────────────────────────────────────

export const vendorService = {
  list: (filters: { search?: string; page?: number } = {}) =>
    getPaged<Vendor>('/vendors', params({
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: 20,
    })),
  options: () => cachedGet<Vendor[]>('/vendors', { limit: 100, page: 1 }),
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Vendor>({ method: 'POST', url: '/vendors', data: input }, 'Vendor'),
};

export const poService = {
  list: (filters: {
    projectId?: string | null;
    vendorId?: string;
    status?: PurchaseOrderStatus | '';
    search?: string;
    page?: number;
  } = {}) =>
    getPaged<PurchaseOrder>('/purchase-orders', params({
      projectId: filters.projectId ?? undefined,
      vendorId: filters.vendorId || undefined,
      status: filters.status || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: 20,
    })),
  get: async (id: string): Promise<{ purchaseOrder: PurchaseOrder; approval?: Approval | null }> => {
    try {
      const res = await api.get<ApiResponse<any>>(`/purchase-orders/${id}`);
      return res.data.data;
    } catch (err) {
      const cached = await cachedGet<any>(`/purchase-orders/${id}`, {});
      if (cached) return cached;
      throw err;
    }
  },
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<PurchaseOrder>({ method: 'POST', url: '/purchase-orders', data: input }, 'Purchase order'),
  transition: (id: string, action: string, extra: Record<string, unknown> = {}) =>
    mutateWithOfflineQueue<PurchaseOrder>(
      { method: 'POST', url: `/purchase-orders/${id}/transition`, data: { action, ...extra } },
      'PO',
    ),
  recordPayment: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<PurchaseOrder>(
      { method: 'POST', url: `/purchase-orders/${id}/payments`, data: input },
      'PO payment',
    ),
};

// ── Equipment ────────────────────────────────────────────────────

export const equipmentService = {
  list: (filters: { projectId?: string | null; status?: string; search?: string; page?: number } = {}) =>
    getPaged<Equipment>('/equipment', params({
      projectId: filters.projectId ?? undefined,
      status: filters.status || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: 20,
    })),
  get: async (id: string): Promise<{ equipment: Equipment; recentEntries: any[] }> => {
    const res = await api.get<ApiResponse<any>>(`/equipment/${id}`);
    return res.data.data;
  },
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Equipment>({ method: 'POST', url: '/equipment', data: input }, 'Equipment'),
  logUsage: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Equipment>(
      { method: 'POST', url: `/equipment/${id}/logs`, data: input },
      'Usage log',
    ),
};

// ── Documents ────────────────────────────────────────────────────

export const documentService = {
  list: (filters: {
    projectId?: string | null;
    category?: string;
    expiring?: boolean;
    search?: string;
    page?: number;
  } = {}) =>
    getPaged<DocumentFile>('/documents', params({
      projectId: filters.projectId ?? undefined,
      category: filters.category || undefined,
      expiring: filters.expiring ? 'true' : undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: 30,
    })),
  upload: (file: { uri: string; mimeType: string }, meta: Record<string, unknown>, onProgress?: (pct: number) => void) =>
    import('./photoService').then(async ({ uploadFileGeneric }) =>
      uploadFileGeneric<DocumentFile>('/documents', file, meta, onProgress),
    ),
};

// ── Approvals ────────────────────────────────────────────────────

export const approvalService = {
  list: (filters: { entityType?: string; status?: ApprovalStatus | ''; mine?: boolean; page?: number } = {}) =>
    getPaged<Approval>('/approvals', params({
      entityType: filters.entityType || undefined,
      status: filters.status || undefined,
      mine: filters.mine ? 'true' : undefined,
      page: filters.page ?? 1,
      limit: 30,
    })),
  act: (id: string, decision: 'approve' | 'reject' | 'request_changes', comment?: string) =>
    api
      .post<ApiResponse<Approval>>(`/approvals/${id}/act`, { decision, comment })
      .then((res) => res.data.data),
};

// ── Milestones ───────────────────────────────────────────────────

export const milestoneService = {
  list: (filters: { projectId?: string | null; view?: string; page?: number } = {}) =>
    getPaged<Milestone>('/milestones', params({
      projectId: filters.projectId ?? undefined,
      view: filters.view && filters.view !== 'all' ? filters.view : undefined,
      page: filters.page ?? 1,
      limit: 50,
    })),
  create: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Milestone>({ method: 'POST', url: '/milestones', data: input }, 'Milestone'),
  update: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<Milestone>({ method: 'PUT', url: `/milestones/${id}`, data: input }, 'Milestone'),
  complete: (id: string) =>
    mutateWithOfflineQueue<Milestone>(
      { method: 'PUT', url: `/milestones/${id}`, data: { completed: true } },
      'Milestone',
    ),
};

// ── Progress ─────────────────────────────────────────────────────

export const progressService = {
  dashboard: (projectId: string) =>
    cachedGet<ProgressDashboard>(`/projects/${projectId}/progress`, {}),
  stages: (projectId: string) =>
    cachedGet<{ stages: ConstructionStage[]; overallProgress: number }>(
      '/progress/stages',
      { projectId },
    ).catch((err) => {
      // Fallback shape when offline cache is empty.
      throw err;
    }),
  updateStage: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<ConstructionStage>(
      { method: 'PUT', url: `/progress/stages/${id}`, data: input },
      'Stage',
    ),
  workItems: (projectId: string) =>
    cachedGet<WorkItem[]>('/progress/work-items', { projectId, limit: 200 }).then((items) =>
      Array.isArray(items)
        ? items
        : ((items as any)?.items ?? []),
    ),
  createWorkItem: (input: Record<string, unknown>) =>
    mutateWithOfflineQueue<WorkItem>({ method: 'POST', url: '/progress/work-items', data: input }, 'Work item'),
  updateWorkItem: (id: string, input: Record<string, unknown>) =>
    mutateWithOfflineQueue<WorkItem>(
      { method: 'PUT', url: `/progress/work-items/${id}`, data: input },
      'Work item',
    ),
};

import type { WorkItem } from '@/types';

// ── Analytics & reports ──────────────────────────────────────────

export const analyticsService = {
  financial: (filters: { projectId?: string | null; from?: string; to?: string } = {}) =>
    cachedGet<FinancialAnalytics>('/analytics/financial', params({
      projectId: filters.projectId ?? undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })),
  executive: () => cachedGet<ExecutiveDashboard>('/analytics/executive', {}),
};

export const reportService = {
  generate: (type: string, filters: { projectId?: string | null; from?: string; to?: string } = {}) =>
    cachedGet<ReportEnvelope>('/analytics/reports', params({
      type,
      projectId: filters.projectId ?? undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })),
};

export const auditService = {
  list: (filters: { module?: string; search?: string; page?: number } = {}) =>
    getPaged<import('@/types').AuditLogEntry>('/audit-logs', params({
      module: filters.module || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 1,
      limit: 30,
    })),
};


