import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { ConstructionStage, ensureDefaultStages, STANDARD_STAGE_NAMES } from '../models/ConstructionStage';
import { WorkItem } from '../models/WorkItem';
import { ProjectNode, refreshAncestorProgress } from '../models/ProjectNode';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, escapeRegex } from '../utils/dates';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

// ── Construction stages ──────────────────────────────────────────

export async function listStages(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const projectId = req.validatedQuery?.projectId;
  await assertProjectAccess(user, projectId);
  await ensureDefaultStages(user.companyId, projectId);

  const stages = await ConstructionStage.find({ projectId }).sort({ order: 1 });
  const today = utcDay(new Date());
  const enriched = stages.map((s: any) => ({
    ...s.toJSON(),
    label:
      s.name === 'custom'
        ? s.customName ?? 'Custom stage'
        : STANDARD_STAGE_NAMES.find((n) => n.value === s.name)?.label ?? s.name,
    isDelayed:
      s.status !== 'completed' &&
      Boolean(s.endDate) &&
      new Date(s.endDate).getTime() < today.getTime(),
  }));
  sendSuccess(res, {
    stages: enriched,
    overallProgress: stages.length
      ? Math.round(stages.reduce((sum: number, s: any) => sum + (s.progressPercentage ?? 0), 0) / stages.length)
      : 0,
  });
}

export async function updateStage(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageProgress')) {
    throw ApiError.forbidden('You cannot update construction progress.');
  }
  const stage = await ConstructionStage.findById(req.params.id);
  if (!stage || !stage.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Stage not found.');
  }
  await assertProjectAccess(user, String(stage.projectId));
  const body = req.validatedBody;

  Object.assign(stage, {
    ...body,
    startDate: body.startDate === undefined ? stage.startDate : body.startDate ? utcDay(body.startDate) : null,
    endDate: body.endDate === undefined ? stage.endDate : body.endDate ? utcDay(body.endDate) : null,
  });

  // Derive status from progress when the caller didn't force one.
  if (!body.status) {
    if ((stage.progressPercentage ?? 0) >= 100) stage.status = 'completed';
    else if ((stage.progressPercentage ?? 0) > 0) stage.status = 'in_progress';
  }
  if (stage.status === 'completed' && !stage.progressPercentage) stage.progressPercentage = 100;
  await stage.save();

  await logAudit(req, {
    action: 'update',
    module: 'progress',
    entityType: 'construction_stage',
    entityId: stage._id,
    description: `${user.name} set ${stage.name} to ${stage.progressPercentage}%`,
    meta: { projectId: stage.projectId },
  });
  sendSuccess(res, stage, 'Stage updated.');
}

// ── Work items ───────────────────────────────────────────────────

export async function listWorkItems(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = {};
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  } else {
    throw ApiError.badRequest('projectId is required.');
  }
  if (q.nodeId) filter.nodeId = q.nodeId;
  if (q.status) filter.status = q.status;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 100, 200);
  const [items, total] = await Promise.all([
    WorkItem.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('nodeId', 'name nodeType')
      .populate('createdBy', 'name'),
    WorkItem.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createWorkItem(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageProgress')) {
    throw ApiError.forbidden('You cannot manage work items.');
  }
  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);
  if (body.nodeId) {
    const node = await ProjectNode.findOne({ _id: body.nodeId, projectId: body.projectId });
    if (!node) throw ApiError.badRequest('Structure level not found in this project.');
  }

  const item = await WorkItem.create({
    ...body,
    companyId: user.companyId,
    nodeId: body.nodeId || null,
    startDate: body.startDate ? utcDay(body.startDate) : null,
    endDate: body.endDate ? utcDay(body.endDate) : null,
    createdBy: user._id,
  });

  if (item.nodeId) await refreshAncestorProgress(item.nodeId, item.projectId, user.companyId);

  await logAudit(req, {
    action: 'create',
    module: 'progress',
    entityType: 'work_item',
    entityId: item._id,
    description: `${user.name} added work item "${item.name}"`,
    meta: { projectId: item.projectId },
  });
  sendCreated(res, item, `Work item "${item.name}" added.`);
}

export async function updateWorkItem(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageProgress')) {
    throw ApiError.forbidden('You cannot update progress.');
  }
  const item = await WorkItem.findById(req.params.id);
  if (!item || !item.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Work item not found.');
  }
  await assertProjectAccess(user, String(item.projectId));
  const body = req.validatedBody;

  Object.assign(item, {
    ...body,
    startDate: body.startDate === undefined ? item.startDate : body.startDate ? utcDay(body.startDate) : null,
    endDate: body.endDate === undefined ? item.endDate : body.endDate ? utcDay(body.endDate) : null,
  });

  if (!body.status && body.progressPercentage !== undefined) {
    if (item.progressPercentage >= 100) {
      item.status = 'completed';
    } else if (item.progressPercentage > 0 && item.status === 'not_started') {
      item.status = 'in_progress';
    }
  }
  if (item.status === 'completed') item.progressPercentage = 100;
  await item.save();

  if (item.nodeId) await refreshAncestorProgress(item.nodeId, item.projectId, user.companyId);

  await logAudit(req, {
    action: 'update',
    module: 'progress',
    entityType: 'work_item',
    entityId: item._id,
    description: `${user.name} updated "${item.name}" to ${item.progressPercentage}%`,
    meta: { projectId: item.projectId },
  });
  sendSuccess(res, item, `"${item.name}" updated.`);
}

export async function deleteWorkItem(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageProgress')) {
    throw ApiError.forbidden('You cannot delete work items.');
  }
  const item = await WorkItem.findById(req.params.id);
  if (!item || !item.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Work item not found.');
  }
  const nodeId = item.nodeId;
  const projectId = item.projectId;
  await item.deleteOne();
  if (nodeId) await refreshAncestorProgress(nodeId, projectId, user.companyId);
  sendSuccess(res, { id: item._id }, 'Work item deleted.');
}

/**
 * GET /api/projects/:id/progress — Module 11 visual dashboard payload.
 * Returns blocks → floors with rolled-up % plus stage timeline.
 */
export async function getProgressDashboard(req: Req & { params: { id: string } }, res: Response) {
  const user = req.user! as AuthUser;
  const project = await assertProjectAccess(user, req.params.id);

  const [nodes, workItems, stages, milestones] = await Promise.all([
    ProjectNode.find({ projectId: project._id }).sort({ order: 1, createdAt: 1 }).lean(),
    WorkItem.find({ projectId: project._id })
      .select('nodeId name progressPercentage status stageName startDate endDate')
      .lean(),
    ConstructionStage.find({ projectId: project._id }).sort({ order: 1 }).lean(),
    import('../models/Milestone').then(({ Milestone }) =>
      Milestone.find({ projectId: project._id }).sort({ dueDate: 1 }).lean(),
    ),
  ]);

  interface ProgressNode {
    _id: string;
    nodeType: string;
    customType?: string | null;
    name: string;
    progressPercentage: number;
    children: ProgressNode[];
    workItems: typeof workItems;
  }

  const map = new Map<string, ProgressNode>();
  for (const n of nodes) {
    map.set(String(n._id), {
      _id: String(n._id),
      nodeType: n.nodeType,
      customType: n.customType,
      name: n.name,
      progressPercentage: n.progressPercentage ?? 0,
      children: [],
      workItems: [],
    });
  }
  const roots: ProgressNode[] = [];
  for (const n of nodes) {
    const node = map.get(String(n._id))!;
    if (n.parentId && map.has(String(n.parentId))) map.get(String(n.parentId))!.children.push(node);
    else roots.push(node);
  }
  for (const w of workItems) {
    if (w.nodeId && map.has(String(w.nodeId))) {
      map.get(String(w.nodeId))!.workItems.push(w);
    }
  }

  const today = utcDay(new Date()).getTime();
  sendSuccess(res, {
    project: {
      _id: project._id,
      name: project.name,
      progressPercentage: project.progressPercentage,
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
    },
    blocks: roots,
    stages: stages.map((s: any) => ({
      ...s,
      label:
        s.name === 'custom'
          ? s.customName ?? 'Custom'
          : STANDARD_STAGE_NAMES.find((n) => n.value === s.name)?.label ?? s.name,
      isDelayed:
        s.status !== 'completed' &&
        Boolean(s.endDate) &&
        new Date(s.endDate).getTime() < today,
    })),
    milestones: milestones.map((m: any) => ({
      ...m,
      effectiveStatus:
        m.completedAt != null
          ? 'completed'
          : m.dueDate && new Date(m.dueDate).getTime() < today
            ? 'delayed'
            : 'upcoming',
    })),
  });
}
