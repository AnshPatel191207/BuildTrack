import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Approval, APPROVAL_CHAINS } from '../models/Approval';
import { normalizeRole } from '../types';
import { hasPermission } from '../utils/permissions';
import { escapeRegex } from '../utils/dates';
import { logAudit } from '../utils/audit';
import { notifyUsers } from '../services/notification.service';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listApprovals(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.entityType) filter.entityType = q.entityType;
  if (q.status) filter.status = q.status;
  if (q.requestedBy) filter.requestedBy = q.requestedBy;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ title: rx }];
  }
  // "Mine" narrows to pending requests sitting at the caller's approval level.
  if (q.mine === 'true') {
    filter.status = 'pending';
    filter.steps = {
      $elemMatch: { level: null, role: user.role, status: 'pending' },
    };
    delete (filter.steps as any).$elemMatch.level;
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    Approval.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('requestedBy', 'name role')
      .populate('projectId', 'name')
      .populate('steps.actedBy', 'name')
      .lean(),
    Approval.countDocuments(filter),
  ]);

  // Flag which approvals the current user can act on right now.
  const enriched = items.map((a: any) => {
    const currentStep = a.steps?.[a.currentLevel];
    return {
      ...a,
      canAct:
        a.status === 'pending' &&
        Boolean(currentStep) &&
        String(currentStep.role) === String(user.role),
      currentStep,
    };
  });
  sendSuccess(res, enriched, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** Create a standalone approval request with the standard chain. */
export async function createApproval(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageExpenses')) {
    throw ApiError.forbidden('You cannot raise approval requests.');
  }
  const body = req.validatedBody;
  const chain: string[] = APPROVAL_CHAINS[body.entityType] ?? ['project_manager', 'owner'];
  const requesterRole = normalizeRole(String(user.role));

  const steps = chain.map((role: string, i: number) => ({
    level: i,
    role,
    label: role.replace(/_/g, ' '),
    status: role === requesterRole ? ('approved' as const) : ('pending' as const),
    actedBy: role === requesterRole ? user._id : null,
    actedAt: role === requesterRole ? new Date() : null,
    comment: role === requesterRole ? 'Raised by this approver' : null,
  }));
  const firstPending = steps.findIndex((s: any) => s.status === 'pending');
  const finalLevel = firstPending === -1 ? steps.length : firstPending;

  const approval = await Approval.create({
    companyId: user.companyId,
    projectId: body.projectId || null,
    entityType: body.entityType,
    entityId: body.entityId || null,
    title: body.title,
    amount: body.amount ?? null,
    requestedBy: user._id,
    steps,
    currentLevel: finalLevel,
    status: finalLevel >= steps.length ? 'approved' : 'pending',
    completedAt: finalLevel >= steps.length ? new Date() : null,
  });

  if (approval.status === 'pending') {
    await notifyApprovers(approval, user);
  }
  sendCreated(res, approval, 'Approval request submitted.');
}

async function notifyApprovers(approval: any, requester: AuthUser): Promise<void> {
  const step = approval.steps?.[approval.currentLevel];
  if (!step) return;
  const User = (await import('../models/User.js')).User;
  const approvers = await User.find({
    companyId: approval.companyId,
    role: { $in: [step.role, ...(step.role === 'project_manager' ? ['manager'] : []), ...(step.role === 'site_engineer' ? ['engineer'] : [])] },
    isActive: true,
  }).select('_id');

  await notifyUsers(
    approvers
      .filter((u: any) => String(u._id) !== String(requester._id))
      .map((u: any) => ({
        userId: u._id,
        title: `Approval needed — ${approval.title}`,
        message: `${requester.name} is waiting for your ${String(step.role).replace('_', ' ')} approval${approval.amount ? ` on ₹${Math.round(approval.amount).toLocaleString('en-IN')}` : ''}.`,
        type: approval.entityType === 'purchase_order' ? ('purchase_approval' as const) : ('expense_approval' as const),
        relatedProjectId: approval.projectId,
      })),
  );
}

/**
 * Approve / reject / request changes at the current step.
 * Side effects fire when the final level approves.
 */
export async function actOnApproval(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const approval = await Approval.findById(req.params.id);
  if (!approval || !approval.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Approval not found.');
  }
  if (approval.status !== 'pending') {
    throw ApiError.badRequest(`This request was already ${approval.status}.`);
  }

  const { decision, comment } = req.validatedBody;
  const step = approval.steps[approval.currentLevel];
  if (!step) throw ApiError.badRequest('This approval has no active step.');

  // Enforce role-based step authorisation (super admin may always act).
  const normalizedUserRole = normalizeRole(String(user.role));
  if (
    normalizedUserRole !== 'super_admin' &&
    String(step.role) !== String(normalizedUserRole)
  ) {
    throw ApiError.forbidden(
      `This step needs ${String(step.role).replace(/_/g, ' ')} approval.`,
    );
  }

  step.actedBy = user._id;
  step.actedAt = new Date();
  step.comment = comment || null;

  switch (decision) {
    case 'approve': {
      step.status = 'approved';
      approval.currentLevel += 1;
      if (approval.currentLevel >= approval.steps.length) {
        approval.status = 'approved';
        approval.completedAt = new Date();
        await applyApprovalSideEffects(approval, req);
      } else {
        await notifyApprovers(approval, user);
      }
      break;
    }
    case 'reject': {
      step.status = 'rejected';
      approval.status = 'rejected';
      approval.completedAt = new Date();
      await applyRejectionSideEffects(approval);
      break;
    }
    case 'request_changes': {
      step.status = 'changes_requested';
      approval.status = 'changes_requested';
      approval.completedAt = new Date();
      break;
    }
  }

  await approval.save();

  const requester = await import('../models/User.js').then(({ User }) =>
    User.findById(approval.requestedBy).select('_id name'),
  );
  if (requester && String(requester._id) !== String(user._id)) {
    const verb =
      decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'sent back for changes';
    await notifyUsers([
      {
        userId: requester._id,
        title: `${approval.title} ${verb} by ${user.name}`,
        message: comment || (decision === 'approve' ? 'It has been approved.' : 'See comments in the approvals queue.'),
        type: approval.entityType === 'booking' ? ('new_booking' as const) : ('expense_approval' as const),
        relatedProjectId: approval.projectId,
      },
    ]);
  }

  await logAudit(req, {
    action: decision === 'approve' ? 'approve' : decision === 'reject' ? 'reject' : 'request_changes',
    module: 'approvals',
    entityType: approval.entityType,
    entityId: approval._id,
    description: `${user.name} ${decision.replace('_', ' ')} "${approval.title}"`,
  });

  sendSuccess(res, approval, decision === 'approve' ? 'Approved.' : decision === 'reject' ? 'Rejected.' : 'Changes requested.');
}

async function applyApprovalSideEffects(approval: any, _req: Request): Promise<void> {
  try {
    if (approval.entityType === 'purchase_order' && approval.entityId) {
      const { PurchaseOrder } = await import('../models/PurchaseOrder.js');
      await PurchaseOrder.updateOne(
        { _id: approval.entityId, status: 'draft' },
        { $set: { status: 'approved', approvedBy: approval.steps.at(-1)?.actedBy } },
      );
    }
    if (approval.entityType === 'expense' && approval.entityId) {
      const { Expense } = await import('../models/Expense.js');
      if (Expense.schema.path('approvalStatus')) {
        await Expense.updateOne(
          { _id: approval.entityId },
          { $set: { approvalStatus: 'approved' } },
        );
      }
    }
    if (approval.entityType === 'booking' && approval.entityId) {
      // The booking stays pending until the sales team confirms it explicitly
      // (which locks the unit); approval simply clears the governance gate and
      // records the owner sign-off here.
      void approval;
    }
  } catch {
    // Side effects must never corrupt the approval state itself.
  }
}

async function applyRejectionSideEffects(approval: any): Promise<void> {
  try {
    if (approval.entityType === 'purchase_order' && approval.entityId) {
      const { PurchaseOrder } = await import('../models/PurchaseOrder.js');
      await PurchaseOrder.updateOne(
        { _id: approval.entityId, status: 'draft' },
        { $set: { status: 'cancelled' } },
      );
    }
  } catch {
    // ignore
  }
}
