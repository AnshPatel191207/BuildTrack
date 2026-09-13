import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { DailyReport } from '../models/DailyReport';
import { accessibleProjectsFilter, assertProjectAccess, canManageOperations } from '../utils/accessControl';
import { utcDay, addDays } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listReports(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};

  let filter = await accessibleProjectsFilter(user);
  filter = { ...filter };
  if (q.projectId) filter._id = q.projectId;
  const projects = await import('../models/Project.js').then(({ Project }) =>
    Project.find(filter).select('_id').lean(),
  );
  const projectIds = projects.map((p: any) => p._id);

  const reportFilter: Record<string, unknown> = { projectId: { $in: projectIds } };
  if (q.from || q.to) {
    const range: Record<string, unknown> = {};
    if (q.from) range.$gte = utcDay(q.from);
    if (q.to) range.$lt = addDays(utcDay(q.to), 1);
    reportFilter.date = range;
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 30, 100);
  const [items, total] = await Promise.all([
    DailyReport.find(reportFilter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name location')
      .populate('createdBy', 'name role'),
    DailyReport.countDocuments(reportFilter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getReport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const report = await DailyReport.findById(req.params.id)
    .populate('projectId', 'name location')
    .populate('createdBy', 'name role');
  if (!report) throw ApiError.notFound('Daily report not found.');
  await assertProjectAccess(user, String(report.projectId._id ?? report.projectId));
  sendSuccess(res, report);
}

export async function createReport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) {
    throw ApiError.forbidden('Only site staff can file daily reports.');
  }
  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const existing = await DailyReport.findOne({
    projectId: body.projectId,
    date: utcDay(body.date),
  });
  if (existing) {
    throw ApiError.conflict(
      `A report for ${body.date} already exists for this project. Edit it instead.`,
    );
  }

  const report = await DailyReport.create({
    ...body,
    companyId: user.companyId,
    projectId: body.projectId,
    date: utcDay(body.date),
    createdBy: user._id,
  });

  await report.populate('projectId', 'name');
  await report.populate('createdBy', 'name');
  sendCreated(res, report, 'Daily report filed.');
}

export async function updateReport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) {
    throw ApiError.forbidden('Only site staff can edit daily reports.');
  }
  const report = await DailyReport.findById(req.params.id);
  if (!report || !report.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Daily report not found.');
  }
  Object.assign(report, req.validatedBody);
  await report.save();
  sendSuccess(res, report, 'Daily report updated.');
}

export async function deleteReport(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) {
    throw ApiError.forbidden('You cannot delete daily reports.');
  }
  const report = await DailyReport.findById(req.params.id);
  if (!report || !report.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Daily report not found.');
  }
  await report.deleteOne();
  sendSuccess(res, { id: report._id }, 'Daily report deleted.');
}
