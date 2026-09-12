import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Project, nextProjectCode, type ProjectDocument } from '../models/Project';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Worker } from '../models/Worker';
import { Attendance } from '../models/Attendance';
import { Material } from '../models/Material';
import { MaterialTransaction } from '../models/MaterialTransaction';
import { Expense } from '../models/Expense';
import { Task } from '../models/Task';
import { DailyReport } from '../models/DailyReport';
import { Photo } from '../models/Photo';
import type { AuthUser } from '../types';
import {
  accessibleProjectsFilter,
  assertProjectAccess,
  canManageAssignedProjects,
} from '../utils/accessControl';
import { notifyProjectStakeholders } from '../services/notification.service';
import { logAudit } from '../utils/audit';
import type { Request, Response } from 'express';

function parseDates(body: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...body };
  for (const key of ['startDate', 'expectedEndDate']) {
    if (typeof body[key] === 'string' && body[key]) {
      out[key] = new Date(`${body[key]}T00:00:00.000Z`);
    }
  }
  return out;
}

export async function listProjects(req: Request & { validatedQuery?: any }, res: Response) {
  const filter = await accessibleProjectsFilter(req.user! as AuthUser);
  const q = req.validatedQuery ?? {};
  if (q.status) filter.status = q.status;
  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { clientName: rx }, { location: rx }];
  }
  const projects = await Project.find(filter)
    .sort({ status: 1, updatedAt: -1 })
    .skip(((q.page ?? 1) - 1) * (q.limit ?? 100))
    .limit(q.limit ?? 100)
    .populate('projectManagerId', 'name');
  const total = await Project.countDocuments(filter);
  sendSuccess(res, projects, 'Success', {
    pagination: {
      page: q.page ?? 1,
      limit: q.limit ?? 100,
      total,
      totalPages: Math.ceil(total / (q.limit ?? 100)),
    },
  });
}

export async function createProject(req: Request & { validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageAssignedProjects(user)) {
    throw ApiError.forbidden('Only owners and managers can create projects.');
  }
  const projectCode = await nextProjectCode(user.companyId);
  const payload = parseDates({ ...(req.validatedBody ?? req.body) });
  delete payload.projectManagerId; // set below with validation
  let managerId: unknown = null;
  if (req.body.projectManagerId) managerId = req.body.projectManagerId;

  const project = await Project.create({
    ...payload,
    companyId: user.companyId,
    projectCode,
    projectManagerId: managerId,
  });

  // If a manager was assigned, make sure they can access the project.
  if (managerId) {
    await assignProjectToUser(managerId, project._id);
  }

  await logAudit(req, {
    action: 'create',
    module: 'projects',
    entityType: 'project',
    entityId: project._id,
    description: `${user.name} created project "${project.name}" (${project.projectCode})`,
  });

  res.status(201).json({
    success: true,
    message: `Project "${project.name}" created successfully.`,
    data: project,
  });
}

async function assignProjectToUser(userId: unknown, projectId: unknown) {
  await User.updateOne(
    { _id: userId },
    { $addToSet: { assignedProjects: projectId } },
  );
}

export async function getProject(req: Request, res: Response) {
  const project = await assertProjectAccess(req.user! as AuthUser, req.params.id);
  await project.populate('projectManagerId', 'name phone');
  sendSuccess(res, project);
}

export async function updateProject(req: Request & { validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const project = await assertProjectAccess(user, req.params.id);

  if (!canManageAssignedProjects(user)) {
    throw ApiError.forbidden('Only owners and managers can edit projects.');
  }

  const payload = parseDates({ ...(req.validatedBody ?? req.body) });

  if (payload.status === 'completed') {
    payload.progressPercentage = 100;
  }

  const previousProgress = project.progressPercentage;
  Object.assign(project, payload);
  await project.save();

  if (managerChanged(payload)) await syncManager(project);

  // Milestone notifications on progress crossings.
  await maybeNotifyMilestone(project, previousProgress);

  await logAudit(req, {
    action: 'update',
    module: 'projects',
    entityType: 'project',
    entityId: project._id,
    description: `${user.name} updated project "${project.name}"${payload.progressPercentage !== undefined ? ` (progress ${project.progressPercentage}%)` : ''}`,
  });

  sendSuccess(res, project, 'Project updated successfully.');
}

function managerChanged(payload: Record<string, unknown>) {
  return 'projectManagerId' in payload;
}

async function syncManager(project: ProjectDocument) {
  if (!project.projectManagerId) return;
  await assignProjectToUser(project.projectManagerId, project._id);
}

async function maybeNotifyMilestone(project: ProjectDocument, previous: number) {
  const current = project.progressPercentage;
  const milestones: Array<[number, string]> = [
    [100, `${project.name} is complete! 🎉`],
    [75, `${project.name} reached ${current}% completion.`],
    [50, `${project.name} is halfway there — ${current}% complete.`],
    [25, `${project.name} crossed ${current}% completion.`],
  ];
  for (const [threshold, title] of milestones) {
    if (previous < threshold && current >= threshold) {
      await notifyProjectStakeholders({
        ownerId: project.companyId ? (await getCompanyOwnerId(project.companyId)) : null,
        managerId: project.projectManagerId,
        projectId: project._id,
        title,
        message: `Construction progress at ${project.location ?? 'site'} is now ${current}%.`,
        type: 'milestone',
      });
      break;
    }
  }
}

async function getCompanyOwnerId(companyId: unknown): Promise<unknown | null> {
  const company = await Company.findById(companyId).select('ownerId');
  return company?.ownerId ?? null;
}

export async function deleteProject(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (user.role !== 'owner') {
    throw ApiError.forbidden('Only the company owner can delete projects.');
  }
  const project = await assertProjectAccess(user, req.params.id);

  // Cascade-delete child records to avoid orphans.
  await Promise.all([
    Attendance.deleteMany({ projectId: project._id }),
    MaterialTransaction.deleteMany({ projectId: project._id }),
    Material.deleteMany({ projectId: project._id }),
    Expense.deleteMany({ projectId: project._id }),
    Task.deleteMany({ projectId: project._id }),
    DailyReport.deleteMany({ projectId: project._id }),
    Photo.deleteMany({ projectId: project._id }),
    Worker.updateMany({ projectId: project._id }, { $set: { projectId: null } }),
    User.updateMany(
      { assignedProjects: project._id },
      { $pull: { assignedProjects: project._id } },
    ),
  ]);

  await project.deleteOne();

  await logAudit(req, {
    action: 'delete',
    module: 'projects',
    entityType: 'project',
    entityId: project._id,
    description: `${user.name} deleted project "${project.name}" and its records`,
  });

  sendSuccess(res, { id: project._id }, `"${project.name}" and its records were deleted.`);
}
