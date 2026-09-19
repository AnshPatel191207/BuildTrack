import { api, cachedGet, API_URL, getAccessToken } from './api';
import type {
  ApiResponse,
  PropertyProject,
  PropertyTower,
  PropertyFloor,
  PropertyUnit,
  PropertyCustomer,
  PropertyBooking,
  PropertyPayment,
  PropertyDashboardStats,
  PropertyDocumentItem,
  PropertyDocumentTemplate,
  ExcelImportPreview,
  Customer360Response,
} from '@/types';

function cleanParams(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

export const propertyService = {
  // ── Projects ───────────────────────────────────────────────────
  listProjects: (filters: { search?: string } = {}) =>
    cachedGet<PropertyProject[]>('/property/projects', cleanParams(filters)),

  createProject: async (input: Partial<PropertyProject>) => {
    const res = await api.post<ApiResponse<PropertyProject>>('/property/projects', input);
    return res.data.data;
  },

  // ── Towers & Floors ────────────────────────────────────────────
  listTowers: (projectId: string) =>
    cachedGet<PropertyTower[]>(`/property/projects/${projectId}/towers`),

  createTower: async (
    projectIdOrInput: string | { projectId: string; name: string; towerNumber?: string; totalFloors?: number; totalUnits?: number; description?: string },
    optionalInput?: { name: string; towerNumber?: string; totalFloors?: number; totalUnits?: number; description?: string },
  ) => {
    const payload = typeof projectIdOrInput === 'string'
      ? { projectId: projectIdOrInput, ...optionalInput }
      : projectIdOrInput;
    const res = await api.post<ApiResponse<PropertyTower>>('/property/towers', payload);
    return res.data.data;
  },

  listFloors: (projectIdOrTowerId: string, optionalTowerId?: string) => {
    const towerId = optionalTowerId || projectIdOrTowerId;
    return cachedGet<PropertyFloor[]>(`/property/towers/${towerId}/floors`);
  },

  createFloor: async (
    projectIdOrInput: string | { projectId: string; towerId: string; floorNumber?: string; name: string; totalUnits?: number; order?: number; description?: string },
    towerIdOrInput?: string | { floorNumber?: string; name: string; totalUnits?: number; order?: number; description?: string },
    optionalInput?: { floorNumber?: string; name: string; totalUnits?: number; order?: number; description?: string },
  ) => {
    let payload: any;
    if (typeof projectIdOrInput === 'string' && typeof towerIdOrInput === 'string') {
      payload = { projectId: projectIdOrInput, towerId: towerIdOrInput, ...optionalInput };
    } else if (typeof projectIdOrInput === 'string') {
      payload = { projectId: projectIdOrInput, ...(towerIdOrInput as any) };
    } else {
      payload = projectIdOrInput;
    }
    const res = await api.post<ApiResponse<PropertyFloor>>('/property/floors', payload);
    return res.data.data;
  },

  deleteTower: async (towerId: string) => {
    const res = await api.delete<ApiResponse<{ id: string; message: string }>>(`/property/towers/${towerId}`);
    return res.data.data;
  },

  deleteFloor: async (floorId: string) => {
    const res = await api.delete<ApiResponse<{ id: string; message: string }>>(`/property/floors/${floorId}`);
    return res.data.data;
  },

  // ── Flats & Shops ──────────────────────────────────────────────
  listFlats: (
    projectIdOrFilters?: string | { projectId?: string; towerId?: string; floorId?: string; status?: string; bedrooms?: number; search?: string; page?: number; limit?: number },
    optionalFilters?: { towerId?: string; floorId?: string; status?: string; bedrooms?: number; search?: string; page?: number; limit?: number },
  ) => {
    const filters = typeof projectIdOrFilters === 'string'
      ? { projectId: projectIdOrFilters, ...optionalFilters }
      : projectIdOrFilters || {};
    return api
      .get<ApiResponse<PropertyUnit[]>>('/property/flats', { params: cleanParams(filters) })
      .then((r) => r.data.data);
  },

  createFlat: async (
    projectIdOrInput: string | Record<string, unknown>,
    optionalInput?: Record<string, unknown>,
  ) => {
    const payload = typeof projectIdOrInput === 'string'
      ? { projectId: projectIdOrInput, ...optionalInput }
      : projectIdOrInput;
    const res = await api.post<ApiResponse<PropertyUnit>>('/property/flats', payload);
    return res.data.data;
  },

  listShops: (
    projectIdOrFilters?: string | { projectId?: string; towerId?: string; status?: string; search?: string; page?: number; limit?: number },
    optionalFilters?: { towerId?: string; status?: string; search?: string; page?: number; limit?: number },
  ) => {
    const filters = typeof projectIdOrFilters === 'string'
      ? { projectId: projectIdOrFilters, ...optionalFilters }
      : projectIdOrFilters || {};
    return api
      .get<ApiResponse<PropertyUnit[]>>('/property/shops', { params: cleanParams(filters) })
      .then((r) => r.data.data);
  },

  createShop: async (
    projectIdOrInput: string | Record<string, unknown>,
    optionalInput?: Record<string, unknown>,
  ) => {
    const payload = typeof projectIdOrInput === 'string'
      ? { projectId: projectIdOrInput, ...optionalInput }
      : projectIdOrInput;
    const res = await api.post<ApiResponse<PropertyUnit>>('/property/shops', payload);
    return res.data.data;
  },

  deleteFlat: async (flatId: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/property/flats/${flatId}`);
    return res.data.data;
  },

  deleteShop: async (shopId: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/property/shops/${shopId}`);
    return res.data.data;
  },

  updateUnit: async (unitId: string, data: Record<string, unknown>) => {
    const res = await api.patch<ApiResponse<PropertyUnit>>(`/property/units/${unitId}`, data);
    return res.data.data;
  },

  deleteUnit: async (unitId: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/property/units/${unitId}`);
    return res.data.data;
  },

  deleteAllUnits: async (filters: { projectId?: string; category?: 'flat' | 'shop' | 'all'; includeBookedSold?: boolean }) => {
    const res = await api.post<ApiResponse<{ deletedCount: number; preservedCount?: number; cancelledBookingsCount?: number; message: string }>>(
      '/property/units/delete-all',
      filters,
    );
    return res.data.data;
  },

  // ── Customers & 360° Profile ───────────────────────────────────
  listCustomers: (filters: { search?: string; stage?: string } = {}) =>
    api
      .get<ApiResponse<PropertyCustomer[]>>('/property/customers', { params: cleanParams(filters) })
      .then((r) => r.data.data),

  getCustomer: async (customerId: string) => {
    const res = await api.get<ApiResponse<PropertyCustomer>>(`/property/customers/${customerId}`);
    return res.data.data;
  },

  getCustomer360: async (customerId: string) => {
    const res = await api.get<ApiResponse<Customer360Response>>(
      `/property/customers/${customerId}/profile`,
    );
    return res.data.data;
  },

  createCustomer: async (input: Partial<PropertyCustomer>) => {
    const res = await api.post<ApiResponse<PropertyCustomer>>('/property/customers', input);
    return res.data.data;
  },

  deleteCustomer: async (customerId: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/property/customers/${customerId}`);
    return res.data.data;
  },

  // ── Bookings ───────────────────────────────────────────────────
  listBookings: (filters: { projectId?: string; status?: string; customerId?: string } = {}) =>
    api
      .get<ApiResponse<PropertyBooking[]>>('/property/bookings', { params: cleanParams(filters) })
      .then((r) => r.data.data),

  getBooking: async (bookingId: string) => {
    const res = await api.get<ApiResponse<any>>(`/property/bookings/${bookingId}`);
    const data = res.data.data;
    if (data && data.booking) {
      const schedule =
        data.payments && data.payments.length > 0
          ? data.payments.map((p: any) => ({
              ...p,
              title:
                p.notes ||
                (p.paymentType === 'booking_amount'
                  ? 'Token Advance'
                  : p.paymentType === 'final'
                    ? 'Final Payment'
                    : `Installment (${p.paymentNumber})`),
              amount: p.amount,
              percentage:
                data.booking.totalValue > 0
                  ? Math.round((p.amount / data.booking.totalValue) * 100)
                  : 0,
              dueDate: p.dueDate,
              status: p.status,
            }))
          : data.booking.paymentSchedule || [];

      return {
        ...data.booking,
        payments: data.payments,
        summary: data.summary,
        paymentSchedule: schedule,
      };
    }
    return data;
  },

  createBooking: async (input: {
    projectId: string;
    unitId: string;
    customerId: string;
    totalAmount: number;
    tokenAmount?: number;
    discountAmount?: number;
    discountReason?: string;
  }) => {
    const res = await api.post<ApiResponse<PropertyBooking>>('/property/bookings', input);
    return res.data.data;
  },

  generateSchedule: async (
    bookingId: string,
    payload: any[] | { milestones?: any[]; installments?: number; startDate?: string; frequencyMonths?: number },
  ) => {
    const body = Array.isArray(payload) ? { milestones: payload } : payload;
    const res = await api.post<ApiResponse<PropertyBooking>>(
      `/property/bookings/${bookingId}/schedule`,
      body,
    );
    return res.data.data;
  },

  deleteBooking: async (bookingId: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/property/bookings/${bookingId}`);
    return res.data.data;
  },

  // ── Receivables & Payments ─────────────────────────────────────
  listPayments: (filters: { bookingId?: string; customerId?: string; status?: string; projectId?: string } = {}) =>
    api
      .get<ApiResponse<PropertyPayment[]>>('/property/payments', { params: cleanParams(filters) })
      .then((r) => r.data.data),

  recordPayment: async (input: {
    bookingId: string;
    customerId?: string;
    amount: number;
    mode: string;
    paymentDate: string;
    transactionId?: string;
    chequeNumber?: string;
    bankName?: string;
    notes?: string;
  }) => {
    const res = await api.post<ApiResponse<PropertyPayment>>('/property/payments', input);
    return res.data.data;
  },

  generateReceipt: async (paymentId: string) => {
    const res = await api.post<ApiResponse<any>>(`/property/payments/${paymentId}/receipt`);
    return res.data.data;
  },

  deleteReceipt: async (paymentId: string) => {
    const res = await api.delete<ApiResponse<{ paymentId: string; message: string }>>(`/property/payments/${paymentId}/receipt`);
    return res.data.data;
  },

  deletePayment: async (paymentId: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/property/payments/${paymentId}`);
    return res.data.data;
  },

  getReceiptPdfUrl: (paymentId: string) => {
    const token = getAccessToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_URL}/property/documents/receipts/${paymentId}/pdf${qs}`;
  },

  getDocumentPdfUrl: (docId: string) => {
    const token = getAccessToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_URL}/property/documents/${docId}/pdf${qs}`;
  },

  // ── Document Generation (Banakhat, Dastavej) ───────────────────
  generateBanakhat: async (bookingId: string, options: Record<string, unknown> = {}) => {
    const res = await api.post<ApiResponse<PropertyDocumentItem>>(
      `/property/bookings/${bookingId}/banakhat`,
      options,
    );
    return res.data.data;
  },

  generateDastavej: async (bookingId: string, options: Record<string, unknown> = {}) => {
    const res = await api.post<ApiResponse<PropertyDocumentItem>>(
      `/property/bookings/${bookingId}/dastavej`,
      options,
    );
    return res.data.data;
  },

  listDocuments: (filters: { documentType?: string; bookingId?: string } = {}) =>
    api
      .get<ApiResponse<PropertyDocumentItem[]>>('/property/documents', {
        params: cleanParams(filters),
      })
      .then((r) => r.data.data),

  deleteDocument: async (documentId: string) => {
    const res = await api.delete<ApiResponse<{ id: string; message: string }>>(`/property/documents/${documentId}`);
    return res.data.data;
  },

  listTemplates: () => cachedGet<PropertyDocumentTemplate[]>('/property/templates'),

  // ── Reports & Dashboard ────────────────────────────────────────
  getDashboardStats: (projectId?: string) =>
    cachedGet<PropertyDashboardStats>('/property/dashboard', projectId ? { projectId } : {}),

  getExportReportUrl: (params: { projectId?: string; reportType: string; format: 'excel' | 'pdf' }) => {
    const token = getAccessToken();
    const clean = cleanParams({ ...params, token });
    const qs = new URLSearchParams(clean as Record<string, string>).toString();
    return `${API_URL}/property/reports/export?${qs}`;
  },

  // ── Excel Bulk Import ──────────────────────────────────────────
  getImportTemplateUrl: (projectId?: string) => {
    const token = getAccessToken();
    const params: Record<string, string> = {};
    if (projectId) params.projectId = projectId;
    if (token) params.token = token;
    const qs = new URLSearchParams(params).toString();
    return `${API_URL}/property/import/template${qs ? `?${qs}` : ''}`;
  },

  previewExcelImport: async (formData: FormData, projectId?: string, overwriteExisting = true) => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    params.append('overwriteExisting', String(overwriteExisting));
    const res = await api.post<ApiResponse<ExcelImportPreview>>(`/property/import/preview?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  executeExcelImport: async (rows: any[], projectId?: string, overwriteExisting = true) => {
    const res = await api.post<ApiResponse<{ insertedUnits?: number; unitsCreated?: number; updatedUnits?: number; towersCreated?: number; floorsCreated?: number }>>(
      '/property/import/execute',
      { validRows: rows, projectId, overwriteExisting },
    );
    return res.data.data;
  },

  // ── Demo Data Seeding ──────────────────────────────────────────
  seedDemoData: async () => {
    const res = await api.post<ApiResponse<any>>('/property/seed-demo');
    return res.data;
  },

  // ── Project Configuration & Dynamic Branding ───────────────────
  getProjectConfiguration: async (projectId: string) => {
    const res = await api.get<ApiResponse<{ project: any }>>(`/property/projects/${projectId}/configuration`);
    return res.data.data.project;
  },

  updateProjectBranding: async (projectId: string, branding: any) => {
    const res = await api.put<ApiResponse<{ branding: any }>>(`/property/projects/${projectId}/branding`, branding);
    return res.data.data;
  },

  uploadProjectLogo: async (projectId: string, formData: FormData) => {
    const res = await api.post<ApiResponse<{ branding: any }>>(`/property/projects/${projectId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  deleteProjectLogo: async (projectId: string, isDark = false) => {
    const res = await api.delete<ApiResponse<{ branding: any }>>(`/property/projects/${projectId}/logo?mode=${isDark ? 'dark' : 'light'}`);
    return res.data.data;
  },

  updateProjectTheme: async (projectId: string, theme: any) => {
    const res = await api.put<ApiResponse<{ theme: any }>>(`/property/projects/${projectId}/theme`, theme);
    return res.data.data;
  },

  updateReceiptConfig: async (projectId: string, receiptConfig: any) => {
    const res = await api.put<ApiResponse<{ receiptConfig: any }>>(`/property/projects/${projectId}/receipt-config`, receiptConfig);
    return res.data.data;
  },

  updateLegalDocConfig: async (projectId: string, legalDocConfig: any) => {
    const res = await api.put<ApiResponse<{ legalDocConfig: any }>>(
      `/property/projects/${projectId}/legal-doc-config`,
      legalDocConfig,
    );
    return res.data.data;
  },

  updateProjectRules: async (projectId: string, rules: any) => {
    const res = await api.put<ApiResponse<any>>(`/property/projects/${projectId}/rules`, rules);
    return res.data.data;
  },

  previewReceipt: async (projectId: string, overrides?: any) => {
    const res = await api.post<ApiResponse<{ previewPdfUrl: string }>>(`/property/projects/${projectId}/receipt-preview`, overrides || {});
    return res.data.data;
  },

  listVariables: async () => {
    const res = await api.get<ApiResponse<{ variables: Array<{ key: string; label: string; category: string; example: string }> }>>('/property/documents/variables');
    return res.data.data.variables;
  },
};
