import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Equipment } from '../models/Equipment';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, escapeRegex } from '../utils/dates';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listEquipment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  }
  if (q.type) filter.type = q.type;
  if (q.ownership) filter.ownership = q.ownership;
  if (q.status) filter.status = q.status;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { equipmentNumber: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total, summaryAgg] = await Promise.all([
    Equipment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name'),
    Equipment.countDocuments(filter),
    Equipment.aggregate([
      { $match: { ...filter } },
      {
        $group: {
          _id: null,
          purchaseValue: { $sum: '$purchaseCost' },
          fuelCost: { $sum: '$fuelCostTotal' },
          maintenanceCost: { $sum: '$maintenanceCostTotal' },
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    extra: {
      summary: {
        count: summaryAgg[0]?.count ?? 0,
        activeCount: summaryAgg[0]?.activeCount ?? 0,
        purchaseValue: Math.round(summaryAgg[0]?.purchaseValue ?? 0),
        fuelCost: Math.round(summaryAgg[0]?.fuelCost ?? 0),
        maintenanceCost: Math.round(summaryAgg[0]?.maintenanceCost ?? 0),
      },
    },
  });
}

export async function createEquipment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageEquipment')) {
    throw ApiError.forbidden('You cannot manage equipment.');
  }
  const body = req.validatedBody;
  if (body.projectId) await assertProjectAccess(user, body.projectId);

  const duplicate = await Equipment.findOne({
    companyId: user.companyId,
    equipmentNumber: body.equipmentNumber,
  });
  if (duplicate) throw ApiError.conflict(`Equipment ${body.equipmentNumber} already exists.`);

  const equipment = await Equipment.create({
    ...body,
    companyId: user.companyId,
    projectId: body.projectId || null,
    purchaseDate: body.purchaseDate ? utcDay(body.purchaseDate) : null,
  });
  await logAudit(req, {
    action: 'create',
    module: 'equipment',
    entityType: 'equipment',
    entityId: equipment._id,
    description: `${user.name} added ${equipment.name} (${equipment.equipmentNumber})`,
  });
  sendCreated(res, equipment, `${equipment.name} added to the fleet.`);
}

export async function getEquipment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const equipment = await Equipment.findById(req.params.id).populate('projectId', 'name');
  if (!equipment || !equipment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Equipment not found.');
  }
  const recentEntries = [...(equipment.usageEntries ?? [])]
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);
  sendSuccess(res, { equipment: { ...equipment.toJSON(), usageEntries: undefined }, recentEntries });
}

export async function updateEquipment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageEquipment')) {
    throw ApiError.forbidden('You cannot manage equipment.');
  }
  const equipment = await Equipment.findById(req.params.id);
  if (!equipment || !equipment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Equipment not found.');
  }
  const body = req.validatedBody;
  Object.assign(equipment, {
    ...body,
    projectId: body.projectId === undefined ? equipment.projectId : body.projectId || null,
    purchaseDate:
      body.purchaseDate === undefined
        ? equipment.purchaseDate
        : body.purchaseDate
          ? utcDay(body.purchaseDate)
          : null,
  });
  await equipment.save();
  sendSuccess(res, equipment, 'Equipment updated.');
}

export async function deleteEquipment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageEquipment')) {
    throw ApiError.forbidden('You cannot manage equipment.');
  }
  const equipment = await Equipment.findById(req.params.id);
  if (!equipment || !equipment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Equipment not found.');
  }
  await equipment.deleteOne();
  sendSuccess(res, { id: equipment._id }, 'Equipment deleted.');
}

/** Daily usage log — updates totals and utilisation. */
export async function addUsageLog(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageEquipment')) {
    throw ApiError.forbidden('You cannot log equipment usage.');
  }
  const equipment = await Equipment.findById(req.params.id);
  if (!equipment || !equipment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Equipment not found.');
  }
  const body = req.validatedBody;
  equipment.usageEntries.push({
    date: utcDay(body.date),
    hoursUsed: body.hoursUsed ?? 0,
    fuelCost: body.fuelCost ?? 0,
    maintenanceCost: body.maintenanceCost ?? 0,
    note: body.note,
  });
  equipment.operatingHours += body.hoursUsed ?? 0;
  equipment.fuelCostTotal += body.fuelCost ?? 0;
  equipment.maintenanceCostTotal += body.maintenanceCost ?? 0;
  // Keep the embedded ledger bounded.
  if (equipment.usageEntries.length > 200) {
    equipment.usageEntries = equipment.usageEntries.slice(-200);
  }
  await equipment.save();

  await logAudit(req, {
    action: 'update',
    module: 'equipment',
    entityType: 'equipment',
    entityId: equipment._id,
    description: `${user.name} logged ${body.hoursUsed ?? 0}h on ${equipment.name}`,
  });
  sendSuccess(res, equipment, `Usage logged for ${equipment.name}.`);
}
