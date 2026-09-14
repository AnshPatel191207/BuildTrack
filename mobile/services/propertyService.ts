import { api, cachedGet, API_URL } from './api';
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

  // ── Bookings ───────────────────────────────────────────────────
  listBookings: (filters: { projectId?: string; status?: string; customerId?: string } = {}) =>
    api
      .get<ApiResponse<PropertyBooking[]>>('/property/bookings', { params: cleanParams(filters) })
      .then((r) => r.data.data),

  getBooking: async (bookingId: string) => {
    const res = await api.get<ApiResponse<PropertyBooking>>(`/property/bookings/${bookingId}`);
    return res.data.data;
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

  generateSchedule: async (bookingId: string, milestones: any[]) => {
    const res = await api.post<ApiResponse<PropertyBooking>>(
      `/property/bookings/${bookingId}/schedule`,
      { milestones },
    );
    return res.data.data;
  },

  // ── Receivables & Payments ─────────────────────────────────────
  listPayments: (filters: { bookingId?: string; customerId?: string } = {}) =>
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

  getReceiptPdfUrl: (paymentId: string) => {
    return `${API_URL}/property/documents/receipts/${paymentId}/pdf`;
  },

  getDocumentPdfUrl: (docId: string) => {
    return `${API_URL}/property/documents/${docId}/pdf`;
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

  listTemplates: () => cachedGet<PropertyDocumentTemplate[]>('/property/templates'),

  // ── Reports & Dashboard ────────────────────────────────────────
  getDashboardStats: (projectId?: string) =>
    cachedGet<PropertyDashboardStats>('/property/dashboard', projectId ? { projectId } : {}),

  getExportReportUrl: (params: { projectId?: string; reportType: string; format: 'excel' | 'pdf' }) => {
    const qs = new URLSearchParams(cleanParams(params) as Record<string, string>).toString();
    return `${API_URL}/property/reports/export?${qs}`;
  },

  // ── Excel Bulk Import ──────────────────────────────────────────
  getImportTemplateUrl: (projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return `${API_URL}/property/import/template${qs}`;
  },

  previewExcelImport: async (formData: FormData) => {
    const res = await api.post<ApiResponse<ExcelImportPreview>>('/property/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  executeExcelImport: async (rows: any[], projectId?: string) => {
    const res = await api.post<ApiResponse<{ unitsCreated: number; towersCreated?: number; floorsCreated?: number }>>(
      '/property/import/execute',
      { validRows: rows, projectId },
    );
    return res.data.data;
  },
};
