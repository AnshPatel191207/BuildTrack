import { api, cachedGet, mutateWithOfflineQueue } from './api';
import type {
  ApiResponse,
  DailyReport,
  Expense,
  ExpenseAnalytics,
  Pagination,
  PaymentMethod,
  Task,
  TaskStatus,
} from '@/types';

// ── Expenses ─────────────────────────────────────────────────────

export interface ExpenseFilters {
  projectId?: string | null;
  category?: string | '';
  paymentMethod?: PaymentMethod | '';
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listExpenses(
  filters: ExpenseFilters = {},
): Promise<{ items: Expense[]; pagination: Pagination }> {
  const params: Record<string, unknown> = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.category) params.category = filters.category;
  if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.search) params.search = filters.search;
  params.page = filters.page ?? 1;
  params.limit = filters.limit ?? 20;

  try {
    const res = await api.get<ApiResponse<Expense[]>>('/expenses', { params });
    return { items: res.data.data, pagination: res.data.pagination! };
  } catch (err) {
    // Fall back to cached list for offline viewing.
    const cached = await cachedGet<Expense[]>('/expenses', { ...params, page: 1, limit: 20 });
    return {
      items: cached,
      pagination: { page: 1, limit: cached.length, total: cached.length, totalPages: 1 },
    };
  }
}

export async function getExpense(id: string): Promise<Expense> {
  const res = await api.get<ApiResponse<Expense>>(`/expenses/${id}`);
  return res.data.data;
}

export interface ExpenseInput {
  projectId: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: string;
  date: string;
  description?: string;
  receiptImage?: { url: string; publicId: string | null } | undefined;
}

export async function createExpense(
  input: ExpenseInput & { receiptImage?: { url: string; publicId: string | null } },
): Promise<Expense> {
  return mutateWithOfflineQueue<Expense>(
    { method: 'POST', url: '/expenses', data: input },
    'Expense',
  );
}

export async function updateExpense(
  id: string,
  input: Partial<Omit<ExpenseInput, 'receiptImage'>> & {
    receiptImage?: { url: string; publicId: string | null };
  },
): Promise<Expense> {
  return mutateWithOfflineQueue<Expense>(
    { method: 'PUT', url: `/expenses/${id}`, data: input },
    'Expense',
  );
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/expenses/${id}`);
}

export async function getExpenseAnalytics(filters: {
  projectId?: string | null;
  month?: string;
}): Promise<ExpenseAnalytics> {
  const params: Record<string, string> = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.month) params.month = filters.month;
  return cachedGet<ExpenseAnalytics>('/expenses/analytics', params);
}

// ── Tasks ────────────────────────────────────────────────────────

export async function listTasks(projectId?: string | null): Promise<Task[]> {
  const params: Record<string, string> = {};
  if (projectId) params.projectId = projectId;
  return cachedGet<Task[]>('/tasks', params);
}

export async function createTask(input: {
  projectId: string;
  title: string;
  description?: string;
  assignedTo?: string | null;
  priority: string;
  status: TaskStatus;
  dueDate?: string | null;
}): Promise<Task> {
  const res = await api.post<ApiResponse<Task>>('/tasks', input);
  return res.data.data;
}

export async function updateTask(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    assignedTo: string | null;
    priority: string;
    status: TaskStatus;
    dueDate: string | null;
  }>,
): Promise<Task> {
  const res = await api.put<ApiResponse<Task>>(`/tasks/${id}`, input);
  return res.data.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

// ── Daily reports ────────────────────────────────────────────────

export async function listReports(
  projectId?: string | null,
  filters: { from?: string; to?: string; page?: number; limit?: number } = {},
): Promise<{ items: DailyReport[]; pagination: Pagination | null }> {
  const params: Record<string, unknown> = {};
  if (projectId) params.projectId = projectId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;
  try {
    const res = await api.get<ApiResponse<DailyReport[]>>('/reports', { params });
    return { items: res.data.data, pagination: res.data.pagination ?? null };
  } catch {
    // Offline fallback — cached page 1.
    const cached = await cachedGet<DailyReport[]>('/reports', { ...params, page: 1, limit: 30 });
    return {
      items: cached,
      pagination: { page: 1, limit: cached.length, total: cached.length, totalPages: 1 },
    };
  }
}

export async function getReport(id: string): Promise<DailyReport> {
  const res = await api.get<ApiResponse<DailyReport>>(`/reports/${id}`);
  return res.data.data;
}

export interface ReportInput {
  projectId: string;
  date: string;
  weather: string;
  summary?: string;
  workCompleted: string;
  workersPresent: number;
  materialsUsed?: string;
  issues?: string;
  safetyNotes?: string;
  tomorrowPlan?: string;
  photos?: string[];
  videos?: string[];
}

export async function createReport(input: ReportInput): Promise<DailyReport> {
  return mutateWithOfflineQueue<DailyReport>(
    { method: 'POST', url: '/reports', data: input },
    'Daily report',
  );
}

export async function deleteReport(id: string): Promise<void> {
  await api.delete(`/reports/${id}`);
}

// Namespace-style exports used by screens
export const expenseService = {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseAnalytics,
};

export const taskService = {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
};

export const reportService = {
  listReports,
  getReport,
  createReport,
  deleteReport,
};
