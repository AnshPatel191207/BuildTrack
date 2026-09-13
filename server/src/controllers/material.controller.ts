import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Material } from '../models/Material';
import { MaterialTransaction } from '../models/MaterialTransaction';
import { assertProjectAccess, canManageOperations, accessibleProjectsFilter } from '../utils/accessControl';
import { notifyProjectStakeholders } from '../services/notification.service';
import { utcDay } from '../utils/dates';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

export async function listMaterials(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};

  let projectIds: unknown[];
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    projectIds = [q.projectId];
  } else {
    const projects = await (
      await import('../models/Project.js')
    ).Project.find(await accessibleProjectsFilter(user)).select('_id');
    projectIds = projects.map((p: any) => p._id);
  }

  const filter: Record<string, unknown> = { projectId: { $in: projectIds } };
  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { category: rx }];
  }

  let materials = await Material.find(filter)
    .populate('projectId', 'name')
    .sort({ category: 1, name: 1 });

  if (q.lowStock === 'true') {
    materials = materials.filter(
      (m: any) => m.minimumStock > 0 && m.currentStock <= m.minimumStock,
    );
  }

  const totalValue = materials.reduce(
    (sum: number, m: any) => sum + m.currentStock * m.averagePrice,
    0,
  );
  const lowStockCount = materials.filter(
    (m: any) => m.minimumStock > 0 && m.currentStock <= m.minimumStock,
  ).length;

  sendSuccess(res, {
    materials,
    summary: {
      count: materials.length,
      lowStockCount,
      estimatedValue: Math.round(totalValue * 100) / 100,
    },
  });
}

export async function createMaterial(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  await assertProjectAccess(user, req.body.projectId);

  // If opening stock is provided, record it as an adjustment transaction so
  // the stock ledger stays consistent.
  const openingStock = req.body.currentStock ?? 0;
  delete req.body.currentStock;

  const material = await Material.create({
    ...req.body,
    companyId: user.companyId,
    currentStock: 0,
  });

  if (openingStock !== 0) {
    await MaterialTransaction.create({
      companyId: user.companyId,
      projectId: material.projectId,
      materialId: material._id,
      type: 'adjustment',
      quantity: openingStock,
      unitPrice: material.averagePrice,
      totalAmount: Math.round(openingStock * material.averagePrice * 100) / 100,
      date: utcDay(new Date()),
      notes: 'Opening stock',
      createdBy: user._id,
    });
    material.currentStock = openingStock;
    material.lastRestockedAt = new Date();
    await material.save();
  }

  res.status(201).json({
    success: true,
    message: `${material.name} added to inventory.`,
    data: material,
  });
}

export async function getMaterial(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  const material = await findAccessibleMaterial(req);
  const transactions = await MaterialTransaction.find({ materialId: material._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('createdBy', 'name');
  void user;
  sendSuccess(res, { material, transactions });
}

async function findAccessibleMaterial(req: Request) {
  const material = await Material.findById(req.params.id);
  if (!material || !material.companyId.equals((req.user as AuthUser).companyId!)) {
    throw ApiError.notFound('Material not found.');
  }
  return material;
}

/**
 * POST /api/materials/:id/transactions — purchase / usage / adjustment / return.
 * Stock is updated atomically with the transaction; usage is rejected when
 * stock would go below zero.
 */
export async function createMaterialTransaction(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();

  const material = await findAccessibleMaterial(req);
  await assertProjectAccess(user, String(material.projectId));

  const { type, quantity, unitPrice, supplier, invoiceNumber, notes } = req.body as {
    type: string;
    quantity: number;
    unitPrice?: number;
    supplier?: string;
    invoiceNumber?: string;
    notes?: string;
  };
  const date = req.body.date ? utcDay(req.body.date) : utcDay(new Date());

  // Determine signed delta.
  let delta = quantity;
  if (type === 'usage') delta = -Math.abs(quantity);
  if (type === 'purchase' || type === 'return') delta = Math.abs(quantity);
  // adjustment uses the sign of quantity as-is.

  if (delta < 0 && (material.currentStock as number) + delta < 0) {
    throw ApiError.badRequest(
      `Not enough stock. Only ${material.currentStock} ${material.unit}(s) available.`,
    );
  }

  const price = type === 'purchase' ? (unitPrice ?? material.averagePrice ?? 0) : (unitPrice ?? 0);
  const totalAmount = Math.round(Math.abs(delta) * price * 100) / 100;

  const transaction = await MaterialTransaction.create({
    companyId: user.companyId,
    projectId: material.projectId,
    materialId: material._id,
    type,
    quantity: delta,
    unitPrice: price,
    totalAmount: type === 'purchase' ? totalAmount : 0,
    supplier,
    invoiceNumber,
    date,
    notes,
    createdBy: user._id,
  });

  const updated = await Material.findOneAndUpdate(
    { _id: material._id, ...(delta < 0 ? { currentStock: { $gte: -delta } } : {}) },
    {
      $inc: { currentStock: delta },
      ...(type === 'purchase'
        ? {
            $set: { lastRestockedAt: new Date() },
            averagePrice: price || material.averagePrice,
          }
        : {}),
    },
    { new: true },
  );

  if (!updated) {
    // Race condition — rollback the transaction doc.
    await transaction.deleteOne();
    throw ApiError.conflict('Stock changed while saving. Please retry.');
  }

  // Low-stock notification.
  if (updated.minimumStock > 0 && updated.currentStock <= updated.minimumStock) {
    const project = await (
      await import('../models/Project.js')
    ).Project.findById(material.projectId).select('name projectManagerId companyId');
    const company = await (
      await import('../models/Company.js')
    ).Company.findById(project?.companyId).select('ownerId');
    await notifyProjectStakeholders({
      ownerId: company?.ownerId,
      managerId: project?.projectManagerId,
      projectId: material.projectId,
      title: `${updated.name} stock is running low`,
      message: `${project?.name}: only ${updated.currentStock} ${updated.unit}(s) left (minimum ${updated.minimumStock}). Consider reordering.`,
      type: 'low_stock',
    });
  }

  sendCreated(res, updated, `Recorded. New stock: ${updated.currentStock} ${updated.unit}(s).`);
}

export async function updateMaterial(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const material = await findAccessibleMaterial(req);
  Object.assign(material, req.body);
  await material.save();
  sendSuccess(res, material, 'Material updated successfully.');
}

export async function deleteMaterial(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();
  const material = await findAccessibleMaterial(req);
  await MaterialTransaction.deleteMany({ materialId: material._id });
  await material.deleteOne();
  sendSuccess(res, { id: material._id }, `${material.name} was removed.`);
}
