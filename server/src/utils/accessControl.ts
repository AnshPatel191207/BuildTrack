import type { AuthUser } from '../types';
import { ApiError } from './apiResponse';
import { Project } from '../models/Project';
import type { FilterQuery } from 'mongoose';
import type { ProjectDocument } from '../models/Project';

/**
 * Access control helpers.
 *
 * Every resource is scoped to the user's company. Super admins bypass company
 * scoping. Owners, project managers and finance/sales leads see their whole
 * company; site staff only see projects they have been explicitly assigned.
 */
const COMPANY_WIDE_ROLES = new Set([
  'super_admin',
  'owner',
  'project_manager',
  'manager',
  'accountant',
  'sales_manager',
]);

export function hasCompanyWideAccess(user: AuthUser): boolean {
  return COMPANY_WIDE_ROLES.has(user.role);
}

function projectScopeFilter(user: AuthUser): FilterQuery<ProjectDocument> {
  const filter: FilterQuery<ProjectDocument> = {};
  if (user.role !== 'super_admin') filter.companyId = user.companyId;
  if (!hasCompanyWideAccess(user)) {
    filter._id = { $in: user.assignedProjects ?? [] };
  }
  return filter;
}

export async function getAccessibleProjectIds(user: AuthUser): Promise<string[]> {
  const docs = await Project.find(projectScopeFilter(user)).select('_id').lean();
  return docs.map((d: any) => String(d._id));
}

export async function accessibleProjectsFilter(
  user: AuthUser,
): Promise<FilterQuery<ProjectDocument>> {
  return projectScopeFilter(user);
}

export async function assertProjectAccess(
  user: AuthUser,
  projectId: string,
): Promise<ProjectDocument> {
  const query: Record<string, unknown> = { _id: projectId };
  if (user.role !== 'super_admin') query.companyId = user.companyId;
  const project = await Project.findOne(query);
  if (!project) {
    throw ApiError.notFound('Project not found.');
  }
  if (
    !hasCompanyWideAccess(user) &&
    !user.assignedProjects.some((id) => id.toString() === projectId)
  ) {
    throw ApiError.forbidden('You are not assigned to this project.');
  }
  return project;
}

/** Can this user create/edit operational data (expenses, attendance, etc.)? */
export function canManageOperations(user: AuthUser): boolean {
  return ['owner', 'manager', 'engineer', 'project_manager', 'site_engineer', 'supervisor', 'super_admin'].includes(user.role);
}

/** Can this user manage company settings themselves? */
export function canManageCompany(user: AuthUser): boolean {
  return ['owner', 'super_admin'].includes(user.role);
}

/** Can this user manage projects themselves? */
export function canManageAssignedProjects(user: AuthUser): boolean {
  return ['owner', 'manager', 'project_manager', 'super_admin'].includes(user.role);
}
