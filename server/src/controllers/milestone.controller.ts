import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Milestone } from '../models/Milestone';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, escapeRegex } from '../utils/dates';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listMilestones(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  }
  if (q.view === 'completed') filter.status = 'completed';
  if (q.view === 'delayed') {
    filter.status = 'upcoming';
    filter.dueDate = { $lt: utcDay(new Date()) };
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 50, 100);
  const [items, total] = await Promise.all([
    Milestone.find(filter)
      .sort({ dueDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name'),
    Milestone.countDocuments(filter),
  ]);

  const today = utcDay(new Date()).getTime();
  const enriched = items.map((m: any) => {
    const isDelayed =
      m.status !== 'completed' && m.dueDate && new Date(m.dueDate).getTime() < today;
    return {
      ...m.toJSON(),
      effectiveStatus: m.status === 'completed' ? 'completed' : isDelayed ? 'delayed' : 'upcoming',
      daysOverdue:
        isDelayed && m.dueDate
          ? Math.ceil((today - new Date(m.dueDate).getTime()) / 86_400_000)
          : null,
      daysUntilDue:
        !isDelayed && m.dueDate
          ? Math.ceil((new Date(m.dueDate).getTime() - today) / 86_400_000)
          : null,
    };
  });
  sendSuccess(res, enriched, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createMilestone(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageProgress')) {
    throw ApiError.forbidden('You cannot manage milestones.');
  }
  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const milestone = await Milestone.create({
    ...body,
    companyId: user.companyId,
    dueDate: utcDay(body.dueDate),
  });
  await logAudit(req, {
    action: 'create',
    module: 'milestones',
    entityType: 'milestone',
    entityId: milestone._id,
    description: `${user.name} added milestone "${milestone.name}" due ${body.dueDate}`,
    meta: { projectId: body.projectId },
  });
  sendCreated(res, milestone, `Milestone "${milestone.name}" created.`);
}

export async function updateMilestone(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageProgress')) {
    throw ApiError.forbidden('You cannot manage milestones.');
  }
  const milestone = await Milestone.findById(req.params.id);
  if (!milestone || !milestone.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Milestone not found.');
  }
  const body = req.validatedBody;
  Object.assign(milestone, body);
  if (body.dueDate) milestone.dueDate = utcDay(body.dueDate);
  if (body.completed) {
    milestone.completedAt = new Date();
    milestone.status = 'completed';
  } else if (body.completed === false) {
    milestone.completedAt = null;
    milestone.status = 'upcoming';
  }
  await milestone.save();

  await logAudit(req, {
    action: body.completed ? 'complete' : 'update',
    module: 'milestones',
    entityType: 'milestone',
    entityId: milestone._id,
    description: `${user.name} updated milestone "${milestone.name}"`,
  });
  sendSuccess(res, milestone, 'Milestone updated.');
}

export async function deleteMilestone(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageProgress')) {
    throw ApiError.forbidden('You cannot manage milestones.');
  }
  const milestone = await Milestone.findById(req.params.id);
  if (!milestone || !milestone.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Milestone not found.');
  }
  await milestone.deleteOne();
  sendSuccess(res, { id: milestone._id }, 'Milestone deleted.');
}
