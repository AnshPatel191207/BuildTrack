import { api, cachedGet } from './api';
import type { ApiResponse, Worker, WorkerDetail, WorkerStatus, WorkerType } from '@/types';

export interface WorkerFilters {
  projectId?: string | null;
  workerType?: WorkerType | '';
  status?: WorkerStatus | '';
  search?: string;
  page?: number;
  limit?: number;
}

export async function listWorkers(
  filters: WorkerFilters = {},
): Promise<{ items: Worker[]; pagination: import('@/types').Pagination }> {
  const params: Record<string, string> = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.workerType) params.workerType = filters.workerType;
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;
  params.page = String(filters.page ?? 1);
  params.limit = String(filters.limit ?? 100);
  const res = await api.get<ApiResponse<Worker[]>>('/workers', { params });
  return {
    items: res.data.data,
    pagination: res.data.pagination ?? {
      page: 1,
      limit: 100,
      total: res.data.data.length,
      totalPages: 1,
    },
  };
}

export async function getWorker(id: string): Promise<WorkerDetail> {
  const res = await api.get<ApiResponse<WorkerDetail>>(`/workers/${id}`);
  return res.data.data;
}

export interface WorkerInput {
  name: string;
  phone?: string;
  workerType: string;
  dailyWage: number;
  skill?: string;
  projectId?: string | null;
  joiningDate?: string;
  status?: string;
  contactId?: string | null;
}

export async function createWorker(input: WorkerInput): Promise<Worker> {
  const res = await api.post<ApiResponse<Worker>>('/workers', input);
  return res.data.data;
}

export async function updateWorker(id: string, input: Partial<WorkerInput>): Promise<Worker> {
  const res = await api.put<ApiResponse<Worker>>(`/workers/${id}`, input);
  return res.data.data;
}

export async function deleteWorker(id: string): Promise<void> {
  await api.delete(`/workers/${id}`);
}

// Namespace-style export used by screens: workerService.xxx(...)
export const workerService = {
  listWorkers,
  getWorker,
  createWorker,
  updateWorker,
  deleteWorker,
};
