import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Worker } from '../models/Worker';
import { Attendance } from '../models/Attendance';
import { assertProjectAccess, canManageOperations, accessibleProjectsFilter } from '../utils/accessControl';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

export async function listWorkers(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const projectFilter = await accessibleProjectsFilter(user);
  const projects = await (await import('../models/Project')).Project.find(projectFilter).select('_id');
  const projectIds = projects.map((p: any) => p._id);

  const filter: Record<string, unknown> = {
    companyId: user.companyId,
    projectId: { $in: q.projectId ? [q.projectId] : projectIds },
  };
  if (q.workerType) filter.workerType = q.workerType;
  if (q.status) filter.status = q.status;
  else filter.status = { $ne: 'terminated' };
  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { skill: rx }];
  }

  const page = q.page ?? 1;
  const limit = q.limit ?? 100;
  const [workers, total] = await Promise.all([
    Worker.find(filter)
      .populate('projectId', 'name location')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Worker.countDocuments(filter),
  ]);
  sendSuccess(res, workers, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createWorker(req: Request & { validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) {
    throw ApiError.forbidden('Your role does not allow adding workers.');
  }
  const body = req.validatedBody ?? req.body;
  let projectId = body.projectId ?? null;
  if (projectId) await assertProjectAccess(user, projectId);

  const worker = await Worker.create({
    ...body,
    companyId: user.companyId,
    joiningDate: body.joiningDate ? new Date(`${body.joiningDate}T00:00:00Z`) : new Date(),
  });
  res.status(201).json({
    success: true,
    message: `${worker.name} was added to the team.`,
    data: worker,
  });
}

export async function getWorker(req: Request, res: Response) {
  const worker = await findAccessibleWorker(req);
  await worker.populate('projectId', 'name location status');

  // Attendance history for the last 30 records + monthly stats.
  const history = await Attendance.find({ workerId: worker._id })
    .sort({ date: -1 })
    .limit(30)
    .populate('projectId', 'name');

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const statsAgg = await Attendance.aggregate([
    {
      $match: {
        workerId: worker._id,
        date: { $gte: monthStart },
      },
    },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const stats: Record<string, number> = {};
  for (const row of statsAgg) stats[row._id] = row.count;

  const presentDays =
    (stats.present ?? 0) + 0.5 * (stats.half_day ?? 0);
  const salaryEstimate = Math.round(presentDays * worker.dailyWage);

  sendSuccess(res, {
    worker,
    attendanceHistory: history,
    thisMonth: {
      present: stats.present ?? 0,
      absent: stats.absent ?? 0,
      halfDay: stats.half_day ?? 0,
      leave: stats.leave ?? 0,
      estimatedSalary: salaryEstimate,
    },
  });
}

async function findAccessibleWorker(req: Request) {
  const worker = await Worker.findById(req.params.id);
  if (!worker || !worker.companyId.equals((req.user as AuthUser).companyId!)) {
    throw ApiError.notFound('Worker not found.');
  }
  if (
    (req.user as AuthUser).role !== 'owner' &&
    !worker.projectId
  ) {
    // Unassigned workers are visible company-wide; no extra check needed.
  }
  return worker;
}

export async function updateWorker(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const worker = await Worker.findById(req.params.id);
  if (!worker || !worker.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Worker not found.');
  }
  if (req.body.projectId !== undefined && req.body.projectId) {
    await assertProjectAccess(user, req.body.projectId);
  }
  if (typeof req.body.joiningDate === 'string' && req.body.joiningDate) {
    req.body.joiningDate = new Date(`${req.body.joiningDate}T00:00:00Z`);
  }
  Object.assign(worker, req.body);
  await worker.save();
  sendSuccess(res, worker, 'Worker updated successfully.');
}

export async function deleteWorker(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const worker = await Worker.findById(req.params.id);
  if (!worker || !worker.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Worker not found.');
  }
  // Keep attendance history but detach the worker record? For MVP remove both.
  await Attendance.deleteMany({ workerId: worker._id });
  await worker.deleteOne();
  sendSuccess(res, { id: worker._id }, `${worker.name} was removed.`);
}
