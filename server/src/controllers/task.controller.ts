import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Task } from '../models/Task';
import { assertProjectAccess, canManageOperations, accessibleProjectsFilter } from '../utils/accessControl';
import { utcDay } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

export async function listTasks(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};

  let projectIds: unknown[];
  if (q.projectId) {
    const p = await assertProjectAccess(user, q.projectId);
    projectIds = [p._id];
  } else {
    const projects = await (
      await import('../models/Project.js')
    ).Project.find(await accessibleProjectsFilter(user)).select('_id');
    projectIds = projects.map((p: any) => p._id);
  }

  const filter: Record<string, unknown> = { projectId: { $in: projectIds } };
  if (q.status) filter.status = q.status;

  const tasks = await Task.find(filter)
    .sort({ status: 1, dueDate: 1, createdAt: -1 })
    .populate('assignedTo', 'name role avatar')
    .populate('createdBy', 'name')
    .populate('projectId', 'name');

  const today = utcDay(new Date());
  const overdue = tasks.filter(
    (t: any) => t.dueDate && t.status !== 'completed' && new Date(t.dueDate) < today,
  ).length;

  sendSuccess(res, tasks, 'Success', undefined);
  void overdue;
}

/** GET /api/tasks — grouped board view payload. */
export async function taskBoard(req: Request & { validatedQuery?: any }, res: Response) {
  await listTasks(req, res);
}

export async function createTask(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  await assertProjectAccess(user, req.body.projectId);

  const task = await Task.create({
    ...req.body,
    companyId: user.companyId,
    createdBy: user._id,
    dueDate: req.body.dueDate ? utcDay(req.body.dueDate) : null,
    completedAt: req.body.status === 'completed' ? new Date() : null,
  });
  await task.populate('assignedTo', 'name role');
  res.status(201).json({ success: true, message: `Task "${task.title}" created.`, data: task });
}

export async function updateTask(req: Request & { validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const task = await Task.findById(req.params.id);
  if (!task || !task.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Task not found.');
  }

  const body = req.validatedBody ?? req.body;
  Object.assign(task, body);
  if (typeof body.dueDate === 'string') {
    task.dueDate = body.dueDate ? utcDay(body.dueDate) : null;
  }
  if (body.status === 'completed' && !task.completedAt) task.completedAt = new Date();
  if (body.status && body.status !== 'completed') task.completedAt = null;

  // Notify assignee when a task is assigned to them.
  if (body.assignedTo && String(body.assignedTo) !== String(task.assignedTo ?? '')) {
    const { notifyUsers } = await import('../services/notification.service.js');
    const project = await (await import('../models/Project.js')).Project.findById(
      task.projectId,
    ).select('name');
    await notifyUsers([
      {
        userId: body.assignedTo,
        title: `New task assigned: ${task.title}`,
        message: `${project?.name ?? 'A project'} • ${task.priority} priority${
          task.dueDate ? ` • due ${new Date(task.dueDate).toISOString().slice(0, 10)}` : ''
        }`,
        type: 'general',
        relatedProjectId: task.projectId,
      },
    ]);
  }

  await task.save();
  await task.populate('assignedTo', 'name role');
  sendSuccess(res, task, 'Task updated successfully.');
}

export async function deleteTask(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const task = await Task.findById(req.params.id);
  if (!task || !task.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Task not found.');
  }
  await task.deleteOne();
  sendSuccess(res, { id: task._id }, `Task "${task.title}" deleted.`);
}
