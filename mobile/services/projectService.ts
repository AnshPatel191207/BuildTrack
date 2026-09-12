import { api } from './api';
import type { ApiResponse, Project, ProjectStatus } from '@/types';

export interface ProjectListFilters {
  status?: ProjectStatus | '';
  search?: string;
  page?: number;
  limit?: number;
}

export async function listProjects(
  filters: ProjectListFilters = {},
): Promise<{ items: Project[]; pagination: import('@/types').Pagination }> {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;
  params.page = String(filters.page ?? 1);
  params.limit = String(filters.limit ?? 100);
  const res = await api.get<ApiResponse<Project[]>>('/projects', { params });
  return {
    items: res.data.data,
    pagination: res.data.pagination ?? {
      page: 1,
      limit: params.limit ? Number(params.limit) : 100,
      total: res.data.data.length,
      totalPages: 1,
    },
  };
}

export async function getProject(id: string): Promise<Project> {
  const res = await api.get<ApiResponse<Project>>(`/projects/${id}`);
  return res.data.data;
}

export interface ProjectInput {
  name: string;
  clientName?: string;
  clientPhone?: string;
  location?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  siteRadiusMeters?: number;
  projectType: string;
  startDate: string;
  expectedEndDate?: string;
  budget: number;
  description?: string;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const res = await api.post<ApiResponse<Project>>('/projects', input);
  return res.data.data;
}

export async function updateProject(id: string, input: Partial<ProjectInput> & { status?: string; progressPercentage?: number }): Promise<Project> {
  const res = await api.put<ApiResponse<Project>>(`/projects/${id}`, input);
  return res.data.data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

// Namespace-style export used by screens: projectService.xxx(...)
export const projectService = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};
