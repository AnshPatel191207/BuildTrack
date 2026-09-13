import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Unit } from '../models/Unit';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import { escapeRegex, toObjectId } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export async function listUnits(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  }
  if (q.status) filter.status = q.status;
  if (q.unitType) filter.unitType = new RegExp(escapeRegex(q.unitType), 'i');
  if (q.blockId) filter.blockId = q.blockId;
  if (q.floorId) filter.floorId = q.floorId;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ unitNumber: rx }, { unitType: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 50, 100);
  const [items, total] = await Promise.all([
    Unit.find(filter)
      .sort({ projectId: 1, blockId: 1, floorId: 1, unitNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name')
      .populate('blockId', 'name')
      .populate('floorId', 'name')
      .populate('currentCustomerId', 'name phone'),
    Unit.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createUnit(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageUnits')) {
    throw ApiError.forbidden('You cannot manage unit inventory.');
  }
  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const duplicate = await Unit.findOne({
    companyId: user.companyId,
    projectId: body.projectId,
    unitNumber: body.unitNumber.toUpperCase(),
  });
  if (duplicate) throw ApiError.conflict(`Unit ${body.unitNumber} already exists in this project.`);

  const unit = await Unit.create({
    ...body,
    companyId: user.companyId,
    unitNumber: body.unitNumber.toUpperCase(),
    phaseId: body.phaseId || null,
    blockId: body.blockId || null,
    floorId: body.floorId || null,
    facing: body.facing || null,
    status: body.status ?? 'available',
  });

  await logAudit(req, {
    action: 'create',
    module: 'inventory',
    entityType: 'unit',
    entityId: unit._id,
    description: `${user.name} added unit ${unit.unitNumber}`,
    meta: { projectId: body.projectId },
  });
  sendCreated(res, unit, `Unit ${unit.unitNumber} added to inventory.`);
}

export async function getUnit(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const unit = await Unit.findById(req.params.id)
    .populate('projectId', 'name')
    .populate('blockId', 'name')
    .populate('floorId', 'name')
    .populate('currentCustomerId', 'name phone email')
    .populate('currentBookingId', 'bookingNumber status bookingDate');
  if (!unit || !unit.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Unit not found.');
  }
  sendSuccess(res, unit);
}

export async function updateUnit(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageUnits')) {
    throw ApiError.forbidden('You cannot manage unit inventory.');
  }
  const unit = await Unit.findById(req.params.id);
  if (!unit || !unit.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Unit not found.');
  }
  const body = req.validatedBody;
  if (body.unitNumber) body.unitNumber = body.unitNumber.toUpperCase();
  Object.assign(unit, {
    ...body,
    phaseId: body.phaseId === undefined ? unit.phaseId : body.phaseId || null,
    blockId: body.blockId === undefined ? unit.blockId : body.blockId || null,
    floorId: body.floorId === undefined ? unit.floorId : body.floorId || null,
  });
  await unit.save();

  await logAudit(req, {
    action: 'update',
    module: 'inventory',
    entityType: 'unit',
    entityId: unit._id,
    description: `${user.name} updated unit ${unit.unitNumber}`,
  });
  sendSuccess(res, unit, `Unit ${unit.unitNumber} updated.`);
}

export async function deleteUnit(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageUnits')) {
    throw ApiError.forbidden('You cannot manage unit inventory.');
  }
  const unit = await Unit.findById(req.params.id);
  if (!unit || !unit.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Unit not found.');
  }
  if (['booked', 'sold'].includes(unit.status)) {
    throw ApiError.badRequest(
      `${unit.unitNumber} is ${unit.status}. Cancel its booking before deleting.`,
    );
  }
  await unit.deleteOne();
  await logAudit(req, {
    action: 'delete',
    module: 'inventory',
    entityType: 'unit',
    entityId: unit._id,
    description: `${user.name} deleted unit ${unit.unitNumber}`,
  });
  sendSuccess(res, { id: unit._id }, `Unit ${unit.unitNumber} deleted.`);
}

/** GET /api/units/inventory-summary?projectId= — Module 3 dashboard. */
export async function getInventorySummary(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const match: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    match.projectId = toObjectId(q.projectId);
  }

  const byStatus = await Unit.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalValue' } } },
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s: any) => [s._id, s]));
  const soldValue =
    (statusMap.sold?.value ?? 0) + (statusMap.booked?.value ?? 0);
  const unsoldStatuses = ['available', 'reserved', 'blocked'];
  const unsoldValue = unsoldStatuses.reduce(
    (sum, s) => sum + (statusMap[s]?.value ?? 0),
    0,
  );
  const totalUnits = byStatus.reduce((sum: number, s: any) => sum + s.count, 0);

  // Revenue generated = payments received for units in this scope.
  const paymentMatch: Record<string, unknown> = { ...match, status: 'paid' };
  const revenueAgg = await import('../models/Payment.js').then(({ Payment }) =>
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  );

  const byType = await Unit.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$unitType',
        count: { $sum: 1 },
        available: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  sendSuccess(res, {
    totalUnits,
    available: statusMap.available?.count ?? 0,
    reserved: statusMap.reserved?.count ?? 0,
    booked: statusMap.booked?.count ?? 0,
    sold: statusMap.sold?.count ?? 0,
    blocked: statusMap.blocked?.count ?? 0,
    cancelled: statusMap.cancelled?.count ?? 0,
    soldValue: round(soldValue),
    unsoldInventoryValue: round(unsoldValue),
    potentialRevenue: round(soldValue + unsoldValue),
    revenueCollected: round(revenueAgg[0]?.total ?? 0),
    byType: byType.map((t: any) => ({
      unitType: t._id,
      count: t.count,
      available: t.available,
    })),
  });
}
