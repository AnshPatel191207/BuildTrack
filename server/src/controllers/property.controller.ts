import type { Request, Response } from 'express';
import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Project, nextProjectCode } from '../models/Project';
import { ProjectNode } from '../models/ProjectNode';
import { Unit } from '../models/Unit';
import { Customer } from '../models/Customer';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { PropertyDocument } from '../models/PropertyDocument';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import { seedPropertyDemoData } from '../services/propertySeed.service';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

// ── Property Projects ─────────────────────────────────────────────

export async function listPropertyProjects(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };

  if (q.search) {
    const rx = new RegExp(q.search, 'i');
    filter.$or = [{ name: rx }, { projectCode: rx }, { reraNumber: rx }, { builderName: rx }];
  }

  const projects = await Project.find(filter).sort({ createdAt: -1 });

  // Enrich with live property stats (towers count, units count, available/booked/sold)
  const projectIds = projects.map((p: any) => p._id);
  const [towerCounts, unitStats] = await Promise.all([
    ProjectNode.aggregate([
      { $match: { projectId: { $in: projectIds }, nodeType: { $in: ['tower', 'block'] } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    Unit.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: { projectId: '$projectId', status: '$status' },
          count: { $sum: 1 },
          value: { $sum: '$totalValue' },
        },
      },
    ]),
  ]);

  const towerMap = new Map<string, number>(towerCounts.map((t: any) => [String(t._id), t.count]));
  const unitStatsMap = new Map<string, { available: number; booked: number; sold: number; total: number }>();

  for (const s of unitStats) {
    const pid = String(s._id.projectId);
    if (!unitStatsMap.has(pid)) {
      unitStatsMap.set(pid, { available: 0, booked: 0, sold: 0, total: 0 });
    }
    const current = unitStatsMap.get(pid)!;
    current.total += s.count;
    if (s._id.status === 'available') current.available += s.count;
    else if (s._id.status === 'booked' || s._id.status === 'reserved') current.booked += s.count;
    else if (s._id.status === 'sold') current.sold += s.count;
  }

  const enriched = projects.map((p: any) => {
    const pid = String(p._id);
    const stats = unitStatsMap.get(pid) ?? { available: 0, booked: 0, sold: 0, total: 0 };
    return {
      ...p.toJSON(),
      towersCount: towerMap.get(pid) ?? p.totalTowers ?? 0,
      inventoryStats: stats,
    };
  });

  sendSuccess(res, enriched);
}

export async function createPropertyProject(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canCreateProject')) {
    throw ApiError.forbidden('You do not have permission to create property projects.');
  }

  const body = req.validatedBody;
  const projectCode = await nextProjectCode(user.companyId);

  const project = await Project.create({
    ...body,
    companyId: user.companyId,
    projectCode,
    startDate: body.startDate ? new Date(body.startDate) : new Date(),
    expectedEndDate: body.completionDate ? new Date(body.completionDate) : undefined,
    budget: body.budget || 0,
  });

  await logAudit(req, {
    action: 'create',
    module: 'property_projects',
    entityType: 'project',
    entityId: project._id,
    description: `${user.name} created property project ${project.name} (${projectCode})`,
  });

  sendCreated(res, project, 'Property project created successfully.');
}

// ── Towers & Floors Hierarchy ────────────────────────────────────

export async function listTowers(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const projectId = req.params.projectId || req.query.projectId;
  if (!projectId) throw ApiError.badRequest('projectId is required.');
  await assertProjectAccess(user, String(projectId));

  const towers = await ProjectNode.find({
    companyId: user.companyId,
    projectId,
    nodeType: { $in: ['tower', 'block'] },
  }).sort({ order: 1, name: 1 });

  // Enrich with floor and unit counts
  const towerIds = towers.map((t: any) => t._id);
  const [floors, units] = await Promise.all([
    ProjectNode.aggregate([
      { $match: { parentId: { $in: towerIds }, nodeType: 'floor' } },
      { $group: { _id: '$parentId', count: { $sum: 1 } } },
    ]),
    Unit.aggregate([
      { $match: { blockId: { $in: towerIds } } },
      {
        $group: {
          _id: { towerId: '$blockId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const floorMap = new Map<string, number>(floors.map((f: any) => [String(f._id), f.count]));
  const unitMap = new Map<string, { total: number; available: number; booked: number; sold: number }>();

  for (const u of units) {
    const tid = String(u._id.towerId);
    if (!unitMap.has(tid)) {
      unitMap.set(tid, { total: 0, available: 0, booked: 0, sold: 0 });
    }
    const c = unitMap.get(tid)!;
    c.total += u.count;
    if (u._id.status === 'available') c.available += u.count;
    else if (u._id.status === 'booked' || u._id.status === 'reserved') c.booked += u.count;
    else if (u._id.status === 'sold') c.sold += u.count;
  }

  const enriched = towers.map((t: any) => {
    const tid = String(t._id);
    return {
      ...t.toJSON(),
      floorsCount: floorMap.get(tid) ?? t.totalFloors ?? 0,
      unitsCount: unitMap.get(tid) ?? { total: 0, available: 0, booked: 0, sold: 0 },
    };
  });

  sendSuccess(res, enriched);
}

export async function createTower(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageStructure') && !hasPermission(user.role, 'canManageTowers')) {
    throw ApiError.forbidden('You cannot create towers.');
  }

  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const tower = await ProjectNode.create({
    companyId: user.companyId,
    projectId: body.projectId,
    parentId: null,
    nodeType: 'tower',
    name: body.name.trim(),
    towerNumber: body.towerNumber || null,
    description: body.description || null,
    totalFloors: body.totalFloors || 0,
    createdBy: user._id,
  });

  await logAudit(req, {
    action: 'create',
    module: 'towers',
    entityType: 'project_node',
    entityId: tower._id,
    description: `${user.name} created tower ${tower.name}`,
  });

  sendCreated(res, tower, 'Tower created.');
}

export async function listFloors(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const towerId = req.params.towerId || req.query.towerId;
  if (!towerId) throw ApiError.badRequest('towerId is required.');

  const floors = await ProjectNode.find({
    companyId: user.companyId,
    parentId: towerId,
    nodeType: 'floor',
  }).sort({ order: 1, name: 1 });

  // Get unit counts on each floor
  const floorIds = floors.map((f: any) => f._id);
  const units = await Unit.aggregate([
    { $match: { floorId: { $in: floorIds } } },
    {
      $group: {
        _id: { floorId: '$floorId', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);

  const unitMap = new Map<string, { total: number; available: number; booked: number; sold: number }>();
  for (const u of units) {
    const fid = String(u._id.floorId);
    if (!unitMap.has(fid)) {
      unitMap.set(fid, { total: 0, available: 0, booked: 0, sold: 0 });
    }
    const c = unitMap.get(fid)!;
    c.total += u.count;
    if (u._id.status === 'available') c.available += u.count;
    else if (u._id.status === 'booked' || u._id.status === 'reserved') c.booked += u.count;
    else if (u._id.status === 'sold') c.sold += u.count;
  }

  const enriched = floors.map((f: any) => {
    const fid = String(f._id);
    return {
      ...f.toJSON(),
      unitsCount: unitMap.get(fid) ?? { total: 0, available: 0, booked: 0, sold: 0 },
    };
  });

  sendSuccess(res, enriched);
}

export async function createFloor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageStructure') && !hasPermission(user.role, 'canManageFloors')) {
    throw ApiError.forbidden('You cannot create floors.');
  }

  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const floor = await ProjectNode.create({
    companyId: user.companyId,
    projectId: body.projectId,
    parentId: body.towerId,
    nodeType: 'floor',
    name: body.name.trim(),
    order: body.order || 0,
    description: body.description || null,
    createdBy: user._id,
  });

  sendCreated(res, floor, 'Floor created.');
}

export async function deleteTower(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageStructure') && !hasPermission(user.role, 'canManageTowers')) {
    throw ApiError.forbidden('You do not have permission to delete towers.');
  }

  const { id } = req.params;
  const tower = await ProjectNode.findOne({
    _id: id,
    companyId: user.companyId,
    nodeType: { $in: ['tower', 'block', 'custom'] },
  });
  if (!tower) throw ApiError.notFound('Tower not found.');

  // Find all child floors and all units belonging to this tower
  const floors = await ProjectNode.find({ parentId: tower._id, companyId: user.companyId });
  const floorIds = floors.map((f: any) => f._id);
  const allNodeIds = [tower._id, ...floorIds];

  const units = await Unit.find({
    companyId: user.companyId,
    $or: [{ blockId: tower._id }, { towerId: tower._id }, { floorId: { $in: floorIds } }],
  }).select('_id');
  const unitIds = units.map((u: any) => u._id);

  if (unitIds.length > 0) {
    await Booking.updateMany(
      { unitId: { $in: unitIds }, companyId: user.companyId, status: { $ne: 'cancelled' } },
      { $set: { status: 'cancelled', cancellationReason: `Tower ${tower.name} deleted by administrator` } },
    );
    await Unit.deleteMany({ _id: { $in: unitIds } });
  }

  await ProjectNode.deleteMany({ _id: { $in: allNodeIds } });

  await logAudit(req, {
    action: 'delete',
    module: 'towers',
    entityType: 'project_node',
    entityId: tower._id,
    description: `${user.name} deleted tower ${tower.name} with ${floors.length} floors and ${unitIds.length} units`,
  });

  sendSuccess(res, { id: tower._id, deletedFloors: floors.length, deletedUnits: unitIds.length }, `Tower ${tower.name} deleted successfully.`);
}

export async function deleteFloor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageStructure') && !hasPermission(user.role, 'canManageFloors')) {
    throw ApiError.forbidden('You do not have permission to delete floors.');
  }

  const { id } = req.params;
  const floor = await ProjectNode.findOne({
    _id: id,
    companyId: user.companyId,
    nodeType: 'floor',
  });
  if (!floor) throw ApiError.notFound('Floor not found.');

  const units = await Unit.find({ companyId: user.companyId, floorId: floor._id }).select('_id');
  const unitIds = units.map((u: any) => u._id);

  if (unitIds.length > 0) {
    await Booking.updateMany(
      { unitId: { $in: unitIds }, companyId: user.companyId, status: { $ne: 'cancelled' } },
      { $set: { status: 'cancelled', cancellationReason: `Floor ${floor.name} deleted by administrator` } },
    );
    await Unit.deleteMany({ _id: { $in: unitIds } });
  }

  await floor.deleteOne();

  await logAudit(req, {
    action: 'delete',
    module: 'floors',
    entityType: 'project_node',
    entityId: floor._id,
    description: `${user.name} deleted floor ${floor.name} with ${unitIds.length} units`,
  });

  sendSuccess(res, { id: floor._id, deletedUnits: unitIds.length }, `Floor ${floor.name} deleted successfully.`);
}

// ── Flats & Shops ────────────────────────────────────────────────

export async function listFlats(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.query as any;
  const filter: Record<string, unknown> = {
    companyId: user.companyId,
    category: { $in: ['flat', 'penthouse'] },
  };

  if (q.projectId) filter.projectId = q.projectId;
  if (q.towerId) filter.blockId = q.towerId;
  if (q.floorId) filter.floorId = q.floorId;
  if (q.status) filter.status = q.status;
  if (q.bedrooms) filter.bedrooms = Number(q.bedrooms);
  if (q.unitType) filter.unitType = q.unitType;
  if (q.facing) filter.facing = q.facing;
  if (q.search) {
    const rx = new RegExp(q.search, 'i');
    filter.unitNumber = rx;
  }

  const page = Number(q.page || 1);
  const limit = Math.min(Number(q.limit || 50), 200);

  const [items, total] = await Promise.all([
    Unit.find(filter)
      .sort({ unitNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name projectCode')
      .populate('blockId', 'name')
      .populate('floorId', 'name')
      .populate('currentCustomerId', 'name phone email'),
    Unit.countDocuments(filter),
  ]);

  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createFlat(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageUnits') && !hasPermission(user.role, 'canManageFlats')) {
    throw ApiError.forbidden('You cannot create flats.');
  }

  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const existing = await Unit.findOne({
    projectId: body.projectId,
    unitNumber: body.unitNumber.toUpperCase().trim(),
  });
  if (existing) {
    throw ApiError.conflict(`Flat ${body.unitNumber} already exists in this project.`);
  }

  const basePrice = body.basePrice || body.areaSqft * (body.ratePerSqft || 0);
  const gstAmount = (basePrice * (body.gstPercentage || 5)) / 100;
  const finalPrice = body.totalValue || basePrice + (body.parkingCharges || 0) + gstAmount;

  const flat = await Unit.create({
    ...body,
    companyId: user.companyId,
    blockId: body.towerId || null,
    towerId: body.towerId || null,
    floorId: body.floorId || null,
    category: 'flat',
    unitNumber: body.unitNumber.toUpperCase().trim(),
    basePrice,
    gstAmount,
    finalPrice,
    totalValue: finalPrice,
  });

  await logAudit(req, {
    action: 'create',
    module: 'flats',
    entityType: 'unit',
    entityId: flat._id,
    description: `${user.name} created Flat ${flat.unitNumber}`,
  });

  sendCreated(res, flat, `Flat ${flat.unitNumber} created.`);
}

export async function listShops(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.query as any;
  const filter: Record<string, unknown> = {
    companyId: user.companyId,
    category: { $in: ['shop', 'office'] },
  };

  if (q.projectId) filter.projectId = q.projectId;
  if (q.towerId) filter.blockId = q.towerId;
  if (q.status) filter.status = q.status;
  if (q.search) {
    const rx = new RegExp(q.search, 'i');
    filter.unitNumber = rx;
  }

  const page = Number(q.page || 1);
  const limit = Math.min(Number(q.limit || 50), 200);

  const [items, total] = await Promise.all([
    Unit.find(filter)
      .sort({ unitNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name projectCode')
      .populate('blockId', 'name')
      .populate('floorId', 'name')
      .populate('currentCustomerId', 'name phone email'),
    Unit.countDocuments(filter),
  ]);

  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createShop(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageUnits') && !hasPermission(user.role, 'canManageShops')) {
    throw ApiError.forbidden('You cannot create shops.');
  }

  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const existing = await Unit.findOne({
    projectId: body.projectId,
    unitNumber: body.unitNumber.toUpperCase().trim(),
  });
  if (existing) {
    throw ApiError.conflict(`Shop ${body.unitNumber} already exists in this project.`);
  }

  const price = body.totalValue || body.areaSqft * (body.ratePerSqft || 0);

  const shop = await Unit.create({
    ...body,
    companyId: user.companyId,
    blockId: body.towerId || null,
    towerId: body.towerId || null,
    floorId: body.floorId || null,
    category: 'shop',
    unitType: 'Shop',
    unitNumber: body.unitNumber.toUpperCase().trim(),
    totalValue: price,
    basePrice: price,
    finalPrice: price,
  });

  await logAudit(req, {
    action: 'create',
    module: 'shops',
    entityType: 'unit',
    entityId: shop._id,
    description: `${user.name} created Shop ${shop.unitNumber}`,
  });

  sendCreated(res, shop, `Shop ${shop.unitNumber} created.`);
}

export async function deleteUnit(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageUnits') && !hasPermission(user.role, 'canManageFlats') && !hasPermission(user.role, 'canManageShops')) {
    throw ApiError.forbidden('You do not have permission to delete inventory units.');
  }

  const { id } = req.params;
  const unit = await Unit.findOne({ _id: id, companyId: user.companyId });
  if (!unit) {
    throw ApiError.notFound('Unit not found.');
  }

  // Cancel any active bookings linked to this unit to maintain data integrity
  const activeBookings = await Booking.find({
    unitId: unit._id,
    companyId: user.companyId,
    status: { $ne: 'cancelled' },
  });

  if (activeBookings.length > 0) {
    await Booking.updateMany(
      { unitId: unit._id, companyId: user.companyId, status: { $ne: 'cancelled' } },
      { $set: { status: 'cancelled', cancellationReason: `Unit ${unit.unitNumber} deleted from inventory by administrator` } },
    );
  }

  await Unit.deleteOne({ _id: unit._id });

  await logAudit(req, {
    action: 'delete',
    module: unit.category === 'shop' ? 'shops' : 'flats',
    entityType: 'unit',
    entityId: unit._id,
    description: `${user.name} deleted ${unit.category === 'shop' ? 'Shop' : 'Flat'} ${unit.unitNumber}${unit.status !== 'available' ? ` (was ${unit.status})` : ''}`,
  });

  sendSuccess(
    res,
    {
      deleted: true,
      unitNumber: unit.unitNumber,
      cancelledBookings: activeBookings.length,
      previousStatus: unit.status,
    },
    `${unit.category === 'shop' ? 'Shop' : 'Flat'} ${unit.unitNumber} deleted successfully.${activeBookings.length > 0 ? ` (${activeBookings.length} associated booking(s) cancelled)` : ''}`,
  );
}

export async function updateUnit(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageUnits') && !hasPermission(user.role, 'canManageFlats') && !hasPermission(user.role, 'canManageShops')) {
    throw ApiError.forbidden('You do not have permission to update inventory units.');
  }

  const { id } = req.params;
  const unit = await Unit.findOne({ _id: id, companyId: user.companyId });
  if (!unit) {
    throw ApiError.notFound('Unit not found.');
  }

  const body = req.validatedBody || req.body;

  if (body.unitNumber && body.unitNumber.toUpperCase().trim() !== unit.unitNumber) {
    const existing = await Unit.findOne({
      projectId: unit.projectId,
      unitNumber: body.unitNumber.toUpperCase().trim(),
      _id: { $ne: unit._id },
    });
    if (existing) {
      throw ApiError.conflict(`Unit "${body.unitNumber}" already exists in this project.`);
    }
    unit.unitNumber = body.unitNumber.toUpperCase().trim();
  }

  if (body.unitType !== undefined) unit.unitType = body.unitType;
  if (body.category !== undefined) unit.category = body.category;
  if (body.status !== undefined) unit.status = body.status;

  // Sqmt fields
  if (body.plotAreaSqmt !== undefined) unit.plotAreaSqmt = Number(body.plotAreaSqmt);
  if (body.builtUpAreaSqmt !== undefined) unit.builtUpAreaSqmt = Number(body.builtUpAreaSqmt);
  if (body.carpetAreaSqmt !== undefined) unit.carpetAreaSqmt = Number(body.carpetAreaSqmt);
  if (body.balconyAreaSqmt !== undefined) unit.balconyAreaSqmt = Number(body.balconyAreaSqmt);
  if (body.terraceAreaSqmt !== undefined) unit.terraceAreaSqmt = Number(body.terraceAreaSqmt);
  if (body.saleDeedAmount !== undefined) unit.saleDeedAmount = Number(body.saleDeedAmount);

  // Sqft fields with 2 decimal precision
  if (body.carpetAreaSqft !== undefined) {
    unit.carpetAreaSqft = Number(body.carpetAreaSqft);
  } else if (body.carpetAreaSqmt !== undefined && body.carpetAreaSqmt > 0) {
    unit.carpetAreaSqft = Number((body.carpetAreaSqmt * 10.7639).toFixed(2));
  }

  if (body.builtUpAreaSqft !== undefined) {
    unit.builtUpAreaSqft = Number(body.builtUpAreaSqft);
  } else if (body.builtUpAreaSqmt !== undefined && body.builtUpAreaSqmt > 0) {
    unit.builtUpAreaSqft = Number((body.builtUpAreaSqmt * 10.7639).toFixed(2));
  }

  if (body.areaSqft !== undefined) {
    unit.areaSqft = Number(body.areaSqft);
    unit.superBuiltupAreaSqft = Number(body.areaSqft);
  } else if (unit.builtUpAreaSqft > 0) {
    unit.areaSqft = unit.builtUpAreaSqft;
    unit.superBuiltupAreaSqft = unit.builtUpAreaSqft;
  }

  if (body.bedrooms !== undefined) unit.bedrooms = body.bedrooms;
  if (body.bathrooms !== undefined) unit.bathrooms = body.bathrooms;
  if (body.balconies !== undefined) unit.balconies = body.balconies;
  if (body.floorNumber !== undefined) unit.floorNumber = body.floorNumber;
  if (body.facing !== undefined) unit.facing = body.facing;

  if (body.ratePerSqft !== undefined) unit.ratePerSqft = Number(body.ratePerSqft);
  if (body.parkingSlot !== undefined) unit.parkingSlot = body.parkingSlot;
  if (body.parkingCharges !== undefined) unit.parkingCharges = Number(body.parkingCharges);
  if (body.clubhouseCharges !== undefined) unit.clubhouseCharges = Number(body.clubhouseCharges);
  if (body.gstPercentage !== undefined) unit.gstPercentage = Number(body.gstPercentage);

  if (body.basePrice !== undefined) {
    unit.basePrice = Number(body.basePrice);
  } else if (unit.saleDeedAmount > 0 && (!unit.basePrice || unit.basePrice <= 0)) {
    unit.basePrice = unit.saleDeedAmount;
  }

  if (body.totalValue !== undefined) {
    unit.totalValue = Number(body.totalValue);
    unit.finalPrice = Number(body.totalValue);
  } else if (body.basePrice !== undefined || body.saleDeedAmount !== undefined) {
    const val = unit.saleDeedAmount || unit.basePrice || 0;
    unit.totalValue = val;
    unit.finalPrice = val;
  }

  if (body.notes !== undefined) unit.notes = body.notes;

  await unit.save();

  await logAudit(req, {
    action: 'update',
    module: unit.category === 'shop' ? 'shops' : 'flats',
    entityType: 'unit',
    entityId: unit._id,
    description: `${user.name} updated ${unit.category === 'shop' ? 'Shop' : 'Flat'} ${unit.unitNumber}`,
  });

  sendSuccess(res, unit, `Unit ${unit.unitNumber} updated successfully.`);
}

export async function deleteAllUnits(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageUnits') && !hasPermission(user.role, 'canManageFlats') && !hasPermission(user.role, 'canManageShops')) {
    throw ApiError.forbidden('You do not have permission to delete inventory units.');
  }

  const { projectId, category, includeBookedSold } = req.body || {};

  const filter: Record<string, unknown> = {
    companyId: user.companyId,
  };

  if (projectId && projectId !== 'all' && projectId !== 'undefined') {
    await assertProjectAccess(user, projectId);
    filter.projectId = projectId;
  }

  if (category && category !== 'all') {
    if (category === 'shop') {
      filter.category = { $in: ['shop', 'office'] };
    } else if (category === 'flat') {
      filter.$or = [
        { category: 'flat' },
        { category: 'residential' },
        { category: { $nin: ['shop', 'office'] } },
        { category: null },
        { category: { $exists: false } },
      ];
    } else {
      filter.category = category;
    }
  }

  const shouldIncludeAll = Boolean(includeBookedSold || req.query.includeBookedSold === 'true');

  if (shouldIncludeAll) {
    // Delete ALL units (including booked, sold, reserved)
    const allUnits = await Unit.find(filter).select('_id unitNumber').lean();
    const unitIds = allUnits.map((u: any) => u._id);

    // Cancel all active bookings associated with these units
    let bookingResultModified = 0;
    if (unitIds.length > 0) {
      const bookingResult = await Booking.updateMany(
        { unitId: { $in: unitIds }, companyId: user.companyId, status: { $ne: 'cancelled' } },
        { $set: { status: 'cancelled', cancellationReason: 'Project units deleted from inventory by administrator' } },
      );
      bookingResultModified = bookingResult.modifiedCount;
    }

    const deleteResult = await Unit.deleteMany(filter);

    await logAudit(req, {
      action: 'delete_bulk',
      module: 'inventory',
      entityType: 'unit',
      description: `${user.name} deleted ALL ${deleteResult.deletedCount} units (including booked/sold)${projectId ? ` for project ${projectId}` : ''}`,
    });

    sendSuccess(
      res,
      {
        deletedCount: deleteResult.deletedCount,
        cancelledBookingsCount: bookingResultModified,
        includedBookedSold: true,
      },
      `Deleted all ${deleteResult.deletedCount} unit(s) successfully.${bookingResultModified > 0 ? ` (${bookingResultModified} booking(s) cancelled)` : ''}`,
    );
  } else {
    // Delete available units only (preserve booked/sold units)
    const bookingQuery: Record<string, unknown> = {
      companyId: user.companyId,
      status: { $ne: 'cancelled' },
    };
    if (filter.projectId) bookingQuery.projectId = filter.projectId;

    const bookedUnitIds = await Booking.find(bookingQuery).distinct('unitId');

    const protectedFilter: Record<string, unknown> = {
      ...filter,
      $or: [
        { _id: { $in: bookedUnitIds } },
        { status: { $in: ['booked', 'sold'] } },
        { currentBookingId: { $ne: null } },
      ],
    };
    const protectedCount = await Unit.countDocuments(protectedFilter);

    const deleteFilter: Record<string, unknown> = {
      ...filter,
      _id: { $nin: bookedUnitIds },
      status: { $nin: ['booked', 'sold'] },
      currentBookingId: null,
    };

    const deleteResult = await Unit.deleteMany(deleteFilter);

    await logAudit(req, {
      action: 'delete_bulk',
      module: 'inventory',
      entityType: 'unit',
      description: `${user.name} deleted ${deleteResult.deletedCount} available units${projectId ? ` for project ${projectId}` : ''} (preserved ${protectedCount} booked/sold units)`,
    });

    sendSuccess(
      res,
      {
        deletedCount: deleteResult.deletedCount,
        preservedCount: protectedCount,
        includedBookedSold: false,
      },
      `Deleted ${deleteResult.deletedCount} available unit(s). ${protectedCount} booked/sold unit(s) preserved.`,
    );
  }
}

// ── Customer 360° Profile ────────────────────────────────────────

export async function getCustomer360Profile(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const customerId = req.params.id;

  const customer = await Customer.findOne({ _id: customerId, companyId: user.companyId })
    .populate('projectId', 'name projectCode builderName')
    .populate('assignedTo', 'name email');

  if (!customer) throw ApiError.notFound('Customer not found.');

  // Fetch all Bookings, Units, Payments, Receipts, and Legal Documents for this Customer
  const [bookings, units, payments, documents] = await Promise.all([
    Booking.find({ customerId, companyId: user.companyId })
      .sort({ createdAt: -1 })
      .populate('projectId', 'name projectCode')
      .populate('unitId')
      .populate('salesManagerId', 'name')
      .populate('salesExecutiveId', 'name'),
    Unit.find({ currentCustomerId: customerId, companyId: user.companyId })
      .populate('projectId', 'name projectCode')
      .populate('blockId', 'name')
      .populate('floorId', 'name'),
    Payment.find({ customerId, companyId: user.companyId })
      .sort({ paidDate: -1, dueDate: -1 })
      .populate('bookingId', 'bookingNumber')
      .populate('unitId', 'unitNumber')
      .populate('recordedBy', 'name'),
    PropertyDocument.find({ customerId, companyId: user.companyId })
      .sort({ createdAt: -1 })
      .populate('bookingId', 'bookingNumber')
      .populate('unitId', 'unitNumber'),
  ]);

  // Aggregate financials
  const totalBookedValue = bookings.reduce((sum: number, b: any) => sum + (b.totalValue || 0), 0);
  const paidPayments = payments.filter((p: any) => p.status === 'paid');
  const totalPaid = paidPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const pendingPayments = payments.filter((p: any) => p.status === 'pending');
  const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const now = Date.now();
  const totalOverdue = pendingPayments
    .filter((p: any) => p.dueDate && new Date(p.dueDate).getTime() < now)
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  sendSuccess(res, {
    customer,
    financials: {
      totalBookedValue,
      totalPaid,
      totalPending,
      totalOverdue,
      outstanding: Math.max(0, totalBookedValue - totalPaid),
    },
    metrics: {
      totalBookings: bookings.length,
      totalBookedValue,
      totalPaid,
      totalOutstanding: Math.max(0, totalBookedValue - totalPaid),
    },
    bookings,
    bookedUnits: units,
    payments,
    receipts: payments.filter((p: any) => p.status === 'paid' && p.receiptNumber),
    documents,
    timeline: customer.timeline || [],
  });
}

export async function seedDemoPropertyData(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!user.companyId) {
    throw ApiError.badRequest('User must be associated with a company to seed property data.');
  }
  const result = await seedPropertyDemoData(user.companyId, user._id);
  sendCreated(res, result, 'Property ERP demo data seeded successfully!');
}

