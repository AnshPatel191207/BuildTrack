import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { PurchaseOrder, nextPoNumber } from '../models/PurchaseOrder';
import { Vendor } from '../models/Vendor';
import { Material } from '../models/Material';
import { MaterialTransaction } from '../models/MaterialTransaction';
import { Expense } from '../models/Expense';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, escapeRegex } from '../utils/dates';
import { normalizeRole } from '../types';
import { logAudit } from '../utils/audit';
import { notifyUsers } from '../services/notification.service';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

async function getCompanyOwnerId(companyId: unknown): Promise<unknown | null> {
  const { Company } = await import('../models/Company.js');
  const company = await Company.findById(companyId).select('ownerId');
  return company?.ownerId ?? null;
}

export async function listPurchaseOrders(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  }
  if (q.vendorId) filter.vendorId = q.vendorId;
  if (q.status) filter.status = q.status;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ poNumber: rx }, { invoiceNumber: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('vendorId', 'name companyName')
      .populate('projectId', 'name')
      .populate('requestedBy', 'name'),
    PurchaseOrder.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** Create a PO; optionally push it straight into the approval chain. */
export async function createPurchaseOrder(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePurchaseOrders')) {
    throw ApiError.forbidden('You cannot manage purchase orders.');
  }
  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const vendor = await Vendor.findOne({ _id: body.vendorId, companyId: user.companyId });
  if (!vendor) throw ApiError.badRequest('Vendor not found.');

  const totalAmount =
    Math.round(body.items.reduce((s: number, i: any) => s + i.amount, 0) * 100) / 100;

  const poNumber = await nextPoNumber(user.companyId);
  const po = await PurchaseOrder.create({
    companyId: user.companyId,
    projectId: body.projectId,
    vendorId: vendor._id,
    poNumber,
    items: body.items,
    totalAmount,
    status: 'draft',
    expectedDeliveryDate: body.expectedDeliveryDate ? utcDay(body.expectedDeliveryDate) : null,
    notes: body.notes,
    requestedBy: user._id,
  });

  if (body.submitForApproval !== false) {
    await submitForApproval(po, user);
  }

  await logAudit(req, {
    action: 'create',
    module: 'procurement',
    entityType: 'purchase_order',
    entityId: po._id,
    description: `${user.name} raised PO ${po.poNumber} on ${vendor.name} (₹${Math.round(totalAmount).toLocaleString('en-IN')})`,
    meta: { projectId: body.projectId },
  });
  sendCreated(res, po, `PO ${po.poNumber} created.`);
}

async function submitForApproval(po: any, user: AuthUser): Promise<void> {
  const { Approval, APPROVAL_CHAINS } = await import('../models/Approval.js');
  const exists = await Approval.exists({ entityType: 'purchase_order', entityId: po._id });
  if (exists) return;

  const requesterRole = normalizeRole(String(user.role));

  const steps = APPROVAL_CHAINS.purchase_order.map((role: string, i: number) => ({
    level: i,
    role,
    label: role.replace(/_/g, ' '),
    status:
      normalizeRole(role) === requesterRole
        ? ('approved' as const)
        : ('pending' as const),
    actedBy: normalizeRole(role) === requesterRole ? user._id : null,
    actedAt: normalizeRole(role) === requesterRole ? new Date() : null,
    comment: normalizeRole(role) === requesterRole ? 'Raised by this approver' : null,
  }));

  // First pending step index becomes the current level.
  const firstPending = steps.findIndex((s: any) => s.status === 'pending');
  const finalLevel = firstPending === -1 ? steps.length : firstPending;

  await Approval.create({
    companyId: po.companyId,
    projectId: po.projectId,
    entityType: 'purchase_order',
    entityId: po._id,
    title: `PO ${po.poNumber}`,
    amount: po.totalAmount,
    requestedBy: user._id,
    steps,
    currentLevel: finalLevel,
    status: finalLevel >= steps.length ? 'approved' : 'pending',
    completedAt: finalLevel >= steps.length ? new Date() : null,
  });

  if (finalLevel >= steps.length) {
    po.status = 'approved';
    po.approvedBy = user._id;
    await po.save();
    return;
  }

  const ownerId = await getCompanyOwnerId(po.companyId);
  await notifyUsers(
    [ownerId]
      .filter((id) => id && String(id) !== String(user._id))
      .map((userId) => ({
        userId,
        title: `PO ${po.poNumber} awaiting approval`,
        message: `${po.items.length} item(s), ₹${Math.round(po.totalAmount).toLocaleString('en-IN')} — approve or request changes in the approvals queue.`,
        type: 'purchase_approval' as const,
        relatedProjectId: po.projectId,
      })),
  );
}

/** Edit a draft PO (items/dates/notes only). */
export async function updatePurchaseOrder(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePurchaseOrders')) {
    throw ApiError.forbidden('You cannot manage purchase orders.');
  }
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po || !po.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Purchase order not found.');
  }
  if (po.status !== 'draft') {
    // Only drafts are editable; approved+ POs flow through transitions.
    throw ApiError.badRequest(`A ${po.status} PO can no longer be edited.`);
  }
  const body = req.validatedBody;
  if (body.items) {
    po.items = body.items.map((i: any) => ({
      ...i,
      amount: Math.round(i.quantity * i.rate * 100) / 100,
    }));
    po.totalAmount =
      Math.round(po.items.reduce((s: number, i: any) => s + i.amount, 0) * 100) / 100;
  }
  if ('expectedDeliveryDate' in body) {
    po.expectedDeliveryDate = body.expectedDeliveryDate ? utcDay(body.expectedDeliveryDate) : null;
  }
  if (body.notes !== undefined) po.notes = body.notes;
  await po.save();
  sendSuccess(res, po, `PO ${po.poNumber} updated.`);
}

export async function getPurchaseOrder(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const po = await PurchaseOrder.findById(req.params.id)
    .populate('vendorId', 'name companyName phone gstNumber')
    .populate('projectId', 'name')
    .populate('requestedBy', 'name')
    .populate('approvedBy', 'name');
  if (!po || !po.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Purchase order not found.');
  }
  const approval = await import('../models/Approval.js').then(({ Approval }) =>
    Approval.findOne({ entityType: 'purchase_order', entityId: po._id })
      .populate('steps.actedBy', 'name')
      .populate('requestedBy', 'name'),
  );
  sendSuccess(res, {
    purchaseOrder: {
      ...po.toJSON(),
      outstanding: Math.max(po.totalAmount - po.paidAmount, 0),
    },
    approval,
  });
}

/**
 * Lifecycle transitions. Delivery is fully integrated with Materials:
 * stock levels rise and purchase transactions + expenses are recorded.
 */
export async function transitionPurchaseOrder(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePurchaseOrders')) {
    throw ApiError.forbidden('You cannot manage purchase orders.');
  }
  const po = await PurchaseOrder.findById(req.params.id).populate('vendorId', 'name');
  if (!po || !po.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Purchase order not found.');
  }
  const { action, invoiceNumber } = req.validatedBody;

  switch (action) {
    case 'submit_approval': {
      if (!['draft'].includes(po.status)) {
        throw ApiError.badRequest(`PO is already ${po.status}.`);
      }
      await submitForApproval(po, user);
      break;
    }
    case 'order': {
      if (po.status !== 'approved') {
        throw ApiError.badRequest('Only approved POs can be placed with the vendor.');
      }
      po.status = 'ordered';
      po.orderedAt = new Date();
      break;
    }
    case 'deliver': {
      if (po.status !== 'ordered') {
        throw ApiError.badRequest('Mark the PO ordered before recording delivery.');
      }
      po.status = 'delivered';
      po.deliveredAt = new Date();
      if (invoiceNumber) po.invoiceNumber = invoiceNumber;

      // Integrate with the materials ledger: find-or-create stock items.
      for (const item of po.items) {
        let material: any = await Material.findOne({
          projectId: po.projectId,
          name: new RegExp(`^${escapeRegex(item.materialName)}$`, 'i'),
        });
        if (!material) {
          material = await Material.create({
            companyId: po.companyId,
            projectId: po.projectId,
            name: item.materialName,
            category: item.category || 'other',
            unit: item.unit || 'piece',
            currentStock: item.quantity,
            minimumStock: 0,
            averagePrice: item.rate,
            supplier: (po.vendorId as any)?.name,
            lastRestockedAt: new Date(),
          });
        } else {
          material.currentStock += item.quantity;
          material.lastRestockedAt = new Date();
          material.averagePrice = Math.round(((material.averagePrice + item.rate) / 2) * 100) / 100;
          await material.save();
        }
        await MaterialTransaction.create({
          companyId: po.companyId,
          projectId: po.projectId,
          materialId: material._id,
          type: 'purchase',
          quantity: item.quantity,
          unitPrice: item.rate,
          totalAmount: Math.round(item.amount * 100) / 100,
          supplier: (po.vendorId as any)?.name,
          invoiceNumber: invoiceNumber || po.poNumber,
          date: utcDay(new Date().toISOString().slice(0, 10)),
          notes: `Auto-posted from ${po.poNumber}`,
          createdBy: user._id,
        });
      }

      // Mirror the invoice into project spend so budgets stay true.
      const expense = await Expense.create({
        companyId: po.companyId,
        projectId: po.projectId,
        title: `${po.poNumber} — ${(po.vendorId as any)?.name ?? 'Vendor'} supply`,
        category: 'materials',
        amount: Math.round(po.totalAmount),
        paymentMethod: 'bank_transfer',
        date: utcDay(new Date().toISOString().slice(0, 10)),
        description: `Recorded automatically when ${po.poNumber} was delivered.${invoiceNumber ? ` Invoice ${invoiceNumber}.` : ''}`,
        createdBy: user._id,
      });
      await Expense.aggregate([
        { $match: { projectId: po.projectId } },
        { $group: { _id: '$projectId', total: { $sum: '$amount' } } },
      ]).then(async ([agg]: any[]) => {
        if (agg) {
          const { Project } = await import('../models/Project.js');
          await Project.updateOne(
            { _id: po.projectId },
            { $set: { spentAmount: Math.round(agg.total) } },
          );
        }
      });
      void expense;

      const ownerId = await getCompanyOwnerId(po.companyId);
      if (ownerId && String(ownerId) !== String(user._id)) {
        await notifyUsers([
          {
            userId: ownerId,
            title: `${po.poNumber} delivered`,
            message: `${(po.vendorId as any)?.name ?? 'Vendor'} delivered materials worth ₹${Math.round(po.totalAmount).toLocaleString('en-IN')}; stock updated.`,
            type: 'general',
            relatedProjectId: po.projectId,
          },
        ]);
      }
      break;
    }
    case 'close': {
      if (!['delivered', 'ordered'].includes(po.status)) {
        throw ApiError.badRequest(`Cannot close a PO in "${po.status}" state.`);
      }
      po.status = 'closed';
      po.closedAt = new Date();
      break;
    }
    case 'cancel': {
      if (['delivered', 'closed'].includes(po.status)) {
        throw ApiError.badRequest('Delivered or closed POs cannot be cancelled.');
      }
      po.status = 'cancelled';
      await import('../models/Approval.js').then(({ Approval }) =>
        Approval.updateMany(
          { entityType: 'purchase_order', entityId: po._id, status: 'pending' },
          { $set: { status: 'rejected' } },
        ),
      );
      break;
    }
  }

  await po.save();
  await logAudit(req, {
    action: 'status_change',
    module: 'procurement',
    entityType: 'purchase_order',
    entityId: po._id,
    description: `${user.name} set PO ${po.poNumber} to ${action.replace('_', ' ')}`,
  });
  sendSuccess(res, po, `PO ${po.poNumber} updated.`);
}

/** Record part/full payment against a PO (payables side). */
export async function recordPoPayment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePayments')) {
    throw ApiError.forbidden('You cannot record payments.');
  }
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po || !po.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Purchase order not found.');
  }
  const body = req.validatedBody;
  if (po.paidAmount + body.amount > po.totalAmount) {
    throw ApiError.badRequest(
      `Payment exceeds the PO value by ₹${Math.round(po.paidAmount + body.amount - po.totalAmount).toLocaleString('en-IN')}.`,
    );
  }
  po.paidAmount = Math.round((po.paidAmount + body.amount) * 100) / 100;
  await po.save();

  await logAudit(req, {
    action: 'payment_recorded',
    module: 'procurement',
    entityType: 'purchase_order',
    entityId: po._id,
    description: `${user.name} paid ₹${Math.round(body.amount).toLocaleString('en-IN')} against ${po.poNumber}`,
  });
  sendSuccess(res, po, `Payment recorded. Outstanding ₹${Math.round(po.totalAmount - po.paidAmount).toLocaleString('en-IN')}.`);
}
