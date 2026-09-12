import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Vendor } from '../models/Vendor';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { escapeRegex } from '../utils/dates';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listVendors(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [
      { name: rx },
      { companyName: rx },
      { gstNumber: rx },
      { materialsSupplied: rx },
    ];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    Vendor.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Vendor.countDocuments(filter),
  ]);

  // Order / delivery / spend stats derived from purchase orders.
  const vendorIds = items.map((v: any) => v._id);
  const stats = await PurchaseOrder.aggregate([
    { $match: { vendorId: { $in: vendorIds }, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$vendorId',
        orders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        totalValue: { $sum: '$totalAmount' },
      },
    },
  ]);
  const statMap = new Map<string, { orders?: number; delivered?: number; totalValue?: number }>(stats.map((s: any) => [String(s._id), s] as [string, any]));
  const enriched = items.map((v: any) => {
    const s = statMap.get(String(v._id));
    return {
      ...v.toJSON(),
      orderCount: s?.orders ?? 0,
      deliveredCount: s?.delivered ?? 0,
      totalOrderValue: Math.round(s?.totalValue ?? 0),
    };
  });
  sendSuccess(res, enriched, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createVendor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageVendors')) {
    throw ApiError.forbidden('You cannot manage vendors.');
  }
  const vendor = await Vendor.create({ ...req.validatedBody, companyId: user.companyId });
  await logAudit(req, {
    action: 'create',
    module: 'procurement',
    entityType: 'vendor',
    entityId: vendor._id,
    description: `${user.name} added vendor ${vendor.name}`,
  });
  sendCreated(res, vendor, `${vendor.name} added.`);
}

export async function getVendor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor || !vendor.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Vendor not found.');
  }
  const [orders, paymentsAgg] = await Promise.all([
    PurchaseOrder.find({ vendorId: vendor._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('projectId', 'name')
      .populate('requestedBy', 'name'),
    PurchaseOrder.aggregate([
      { $match: { vendorId: vendor._id } },
      {
        $group: {
          _id: null,
          ordered: { $sum: '$totalAmount' },
          paid: { $sum: '$paidAmount' },
          count: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
        },
      },
    ]),
  ]);
  sendSuccess(res, {
    vendor,
    orders,
    stats: {
      orderCount: paymentsAgg[0]?.count ?? 0,
      deliveredCount: paymentsAgg[0]?.delivered ?? 0,
      totalOrdered: Math.round(paymentsAgg[0]?.ordered ?? 0),
      totalPaid: Math.round(paymentsAgg[0]?.paid ?? 0),
      outstanding:
        Math.round((paymentsAgg[0]?.ordered ?? 0) - (paymentsAgg[0]?.paid ?? 0)) || 0,
    },
  });
}

export async function updateVendor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageVendors')) {
    throw ApiError.forbidden('You cannot manage vendors.');
  }
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor || !vendor.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Vendor not found.');
  }
  Object.assign(vendor, req.validatedBody);
  await vendor.save();
  sendSuccess(res, vendor, 'Vendor updated.');
}

export async function deleteVendor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageVendors')) {
    throw ApiError.forbidden('You cannot manage vendors.');
  }
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor || !vendor.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Vendor not found.');
  }
  const openOrders = await PurchaseOrder.exists({
    vendorId: vendor._id,
    status: { $nin: ['closed', 'cancelled', 'draft'] },
  });
  if (openOrders) {
    throw ApiError.badRequest('This vendor still has open purchase orders.');
  }
  await vendor.deleteOne();
  sendSuccess(res, { id: vendor._id }, 'Vendor deleted.');
}
