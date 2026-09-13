import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Expense } from '../models/Expense';
import { Project } from '../models/Project';
import {
  accessibleProjectsFilter,
  assertProjectAccess,
  canManageOperations,
} from '../utils/accessControl';
import { notifyProjectStakeholders } from '../services/notification.service';
import { startOfMonthUtc, todayUtc, addDays, utcDay } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

const BIG_EXPENSE_THRESHOLD = 50_000;

export async function listExpenses(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};

  let projectIds: unknown[];
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    projectIds = [q.projectId];
  } else {
    const projects = await Project.find(await accessibleProjectsFilter(user)).select('_id');
    projectIds = projects.map((p: any) => p._id);
  }

  const filter: Record<string, unknown> = { projectId: { $in: projectIds } };
  if (q.category) filter.category = q.category;
  if (q.paymentMethod) filter.paymentMethod = q.paymentMethod;
  if (q.from || q.to) {
    filter.date = {};
    if (q.from) (filter.date as any).$gte = utcDay(q.from);
    if (q.to) (filter.date as any).$lte = addDays(utcDay(q.to), 1);
  }
  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { category: rx }];
  }

  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  const [items, total] = await Promise.all([
    Expense.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name')
      .populate('createdBy', 'name'),
    Expense.countDocuments(filter),
  ]);

  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createExpense(req: Request & { validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const body = req.validatedBody ?? req.body;
  const project = await assertProjectAccess(user, body.projectId);

  const expense = await Expense.create({
    ...body,
    companyId: user.companyId,
    createdBy: user._id,
    date: utcDay(body.date),
  });

  // Keep the project financial summary in sync (source of truth = expenses).
  await Project.updateOne(
    { _id: project._id },
    { $inc: { spentAmount: expense.amount } },
  );

  if (expense.amount >= BIG_EXPENSE_THRESHOLD) {
    const company = await (
      await import('../models/Company.js')
    ).Company.findById(project.companyId).select('ownerId');
    await notifyProjectStakeholders({
      ownerId: company?.ownerId,
      managerId: project.projectManagerId,
      projectId: project._id,
      title: `₹${expense.amount.toLocaleString('en-IN')} expense at ${project.name}`,
      message: `"${expense.title}" (${expense.category}) was recorded by ${user.name}.`,
      type: 'expense',
    });
  }

  res.status(201).json({
    success: true,
    message: `Expense of ₹${expense.amount.toLocaleString('en-IN')} added successfully.`,
    data: expense,
  });
}

async function getAccessibleExpense(req: Request) {
  const expense = await Expense.findById(req.params.id);
  if (!expense || !expense.companyId.equals((req.user as AuthUser).companyId!)) {
    throw ApiError.notFound('Expense not found.');
  }
  return expense;
}

export async function getExpense(req: Request, res: Response) {
  const expense = await getAccessibleExpense(req);
  await Promise.all([
    expense.populate('projectId', 'name location'),
    expense.populate('createdBy', 'name role'),
  ]);
  sendSuccess(res, expense);
}

export async function updateExpense(req: Request & { validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const expense = await getAccessibleExpense(req);

  const oldAmount = expense.amount;
  Object.assign(expense, req.validatedBody ?? req.body);
  if (typeof (req.validatedBody ?? req.body).date === 'string') {
    expense.date = utcDay((req.validatedBody ?? req.body).date);
  }
  await expense.save();

  // Re-sync the project total.
  await Project.updateOne(
    { _id: expense.projectId },
    { $inc: { spentAmount: expense.amount - oldAmount } },
  );

  sendSuccess(res, expense, 'Expense updated successfully.');
}

/** Deleting an expense reverses its effect on the project's spent amount. */
export async function deleteExpense(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const expense = await getAccessibleExpense(req);

  await expense.deleteOne();
  await Project.updateOne(
    { _id: expense.projectId },
    { $inc: { spentAmount: -expense.amount } },
  );
  // Never let corrections push the total below zero.
  await Project.updateOne(
    { _id: expense.projectId, spentAmount: { $lt: 0 } },
    { $set: { spentAmount: 0 } },
  );

  sendSuccess(res, { id: expense._id }, `Expense "${expense.title}" deleted.`);
}

/** GET /api/expenses/analytics — category breakdown + totals. */
export async function expenseAnalytics(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};

  let projectIds: unknown[];
  if (q.projectId) {
    const p = await assertProjectAccess(user, q.projectId);
    projectIds = [p._id];
  } else {
    const projects = await Project.find(await accessibleProjectsFilter(user)).select('_id');
    projectIds = projects.map((p: any) => p._id);
  }

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (q.month) {
    const [y, m] = q.month.split('-').map(Number);
    fromDate = new Date(Date.UTC(y, m - 1, 1));
    toDate = new Date(Date.UTC(y, m, 1));
  }

  const match: Record<string, unknown> = { projectId: { $in: projectIds } };
  if (fromDate && toDate) match.date = { $gte: fromDate, $lt: toDate };

  const byCategory = await Expense.aggregate([
    { $match: match as any },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  const byPaymentMethod = await Expense.aggregate([
    { $match: match as any },
    { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  const [totalsRow] = await Expense.aggregate([
    { $match: match as any },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  // Today + this month quick stats across scope.
  const monthStart = startOfMonthUtc();
  const todayStart = todayUtc();
  void todayStart;

  const todayAgg = await Expense.aggregate([
    {
      $match: { ...match, date: { $gte: todayStart, $lt: addDays(todayStart, 1) } } as any,
    },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const monthAgg = await Expense.aggregate([
    { $match: { ...match, date: { $gte: monthStart } } as any },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  sendSuccess(res, {
    periodMonth: q.month ?? null,
    totalSpent: totalsRow?.total ?? 0,
    totalCount: totalsRow?.count ?? 0,
    todayTotal: todayAgg[0]?.total ?? 0,
    monthTotal: monthAgg[0]?.total ?? 0,
    byCategory,
    byPaymentMethod,
  });
}
