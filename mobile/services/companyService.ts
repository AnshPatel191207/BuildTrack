import { api, cachedGet } from './api';
import type {
  ApiResponse,
  Company,
  DashboardMetrics,
  GlobalDashboard,
  ProjectDashboard,
  TodaysActivity,
  User,
} from '@/types';

// ── Dashboard ────────────────────────────────────────────────────

export async function getGlobalDashboard(projectId?: string | null): Promise<GlobalDashboard> {
  return cachedGet<GlobalDashboard>('/dashboard', projectId ? { projectId } : undefined);
}

export interface DashboardBundle {
  metrics: DashboardMetrics;
  todaysActivity: TodaysActivity;
}

export async function getProjectDashboard(projectId: string): Promise<ProjectDashboard> {
  return cachedGet<ProjectDashboard>(`/projects/${projectId}/dashboard`);
}

// ── Company & team ───────────────────────────────────────────────

export async function getCompany(): Promise<Company> {
  return cachedGet<Company>('/company');
}

export async function updateCompany(input: Partial<Company>): Promise<Company> {
  const res = await api.put<ApiResponse<Company>>('/company', input);
  return res.data.data;
}

export async function createCompany(input: Omit<Partial<Company>, 'ownerId'>): Promise<Company> {
  const res = await api.post<ApiResponse<Company>>('/company', input);
  return res.data.data;
}

export async function listTeam(): Promise<User[]> {
  return cachedGet<User[]>('/company/team');
}

export async function inviteTeamMember(input: {
  name: string;
  email: string;
  phone?: string;
  role: string;
  password: string;
  assignedProjects: string[];
}): Promise<User> {
  const res = await api.post<ApiResponse<User>>('/company/team', input);
  return res.data.data;
}

export async function updateTeamMember(
  id: string,
  input: { role?: string; isActive?: boolean; assignedProjects?: string[]; password?: string },
): Promise<User> {
  const res = await api.put<ApiResponse<User>>(`/company/team/${id}`, input);
  return res.data.data;
}

// Namespace-style export used by screens: companyService.xxx(...)
export const companyService = {
  getGlobalDashboard,
  getProjectDashboard,
  getCompany,
  updateCompany,
  createCompany,
  listTeam,
  inviteTeamMember,
  updateTeamMember,
};
