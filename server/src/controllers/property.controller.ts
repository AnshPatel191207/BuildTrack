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
