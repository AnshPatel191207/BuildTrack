import { ApiError, sendSuccess } from '../utils/apiResponse';
import { AuditLog } from '../models/AuditLog';
import { escapeRegex } from '../utils/dates';
import { hasPermission } from '../utils/permissions';
import { utcDay, addDays } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedQuery?: any };

/** GET /api/audit-logs — Module 24. Owner-level governance trail. */
export async function listAuditLogs(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canAuditLogs')) {
    throw ApiError.forbidden('Only owners and accountants can view audit logs.');
  }
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.module) filter.module = q.module;
  if (q.action) filter.action = new RegExp(escapeRegex(q.action), 'i');
  if (q.userId) filter.userId = q.userId;
  if (q.from || q.to) {
    const range: Record<string, unknown> = {};
    if (q.from) range.$gte = utcDay(q.from);
    if (q.to) range.$lt = addDays(utcDay(q.to), 1);
    filter.createdAt = range;
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 30, 100);
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
