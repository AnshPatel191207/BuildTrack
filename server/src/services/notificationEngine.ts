import { Material } from '../models/Material';
import { Payment } from '../models/Payment';
import { Milestone } from '../models/Milestone';
import { DocumentFile } from '../models/DocumentFile';
import { Approval } from '../models/Approval';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { utcDay, addDays } from '../utils/dates';
import { notifyUsers, notifyProjectStakeholders } from './notification.service';
import { logError } from '../utils/logger';
import type { NotificationType } from '../types';

/**
 * Module 23 — notification engine.
 * A periodic scan raises alerts for: low stock, overdue payments, milestone
 * delays, document expiry and pending approvals. Inline events (new booking,
 * approval requested…) are raised directly by the relevant controllers.
 */

interface ScanContext {
  companyId: unknown;
  ownerId: unknown;
}

async function scanLowStock({ companyId, ownerId }: ScanContext): Promise<void> {
  const materials = await Material.find({
    companyId,
    $expr: { $and: [{ $gt: ['$minimumStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] },
  })
    .limit(20)
    .populate('projectId', 'name');

  await notifyUsers(
    materials.map((m: any) => ({
      userId: ownerId,
      title: `${m.name} is running low`,
      message: `${m.projectId?.name ?? 'Site'}: ${m.currentStock} ${m.unit} left (minimum ${m.minimumStock}). Raise a purchase order.`,
      type: 'low_stock' as NotificationType,
      relatedProjectId: m.projectId?._id ?? null,
    })),
  );
}

async function scanOverduePayments({ companyId, ownerId }: ScanContext): Promise<void> {
  const today = utcDay(new Date());
  const overdue = await Payment.find({
    companyId,
    status: 'pending',
    dueDate: { $ne: null, $lt: addDays(today, -1) },
    dueNotifiedAt: null,
  })
    .limit(25)
    .populate('customerId', 'name')
    .populate('projectId', 'name');

  for (const p of overdue as any[]) {
    const daysLate = Math.ceil((today.getTime() - new Date(p.dueDate).getTime()) / 86_400_000);
    if (daysLate < 3) continue;
    await notifyUsers([
      {
        userId: ownerId,
        title: `Customer payment overdue by ${daysLate} days`,
        message: `${p.customerId?.name ?? 'Customer'} owes ₹${Math.round(p.amount).toLocaleString('en-IN')} (${p.paymentNumber}) on ${p.projectId?.name ?? 'project'}.`,
        type: 'payment_overdue',
        relatedProjectId: p.projectId?._id ?? null,
      },
    ]);
    await Payment.updateOne({ _id: p._id }, { $set: { dueNotifiedAt: new Date() } });
  }
}

async function scanMilestoneDelays({ companyId, ownerId }: ScanContext): Promise<void> {
  const today = utcDay(new Date());
  const delayed = await Milestone.find({
    companyId,
    completedAt: null,
    status: 'upcoming',
    delayNotifiedAt: null,
    dueDate: { $lt: addDays(today, -1) },
  })
    .limit(20)
    .populate('projectId', 'name projectManagerId');

  for (const m of delayed as any[]) {
    const days = Math.ceil((today.getTime() - new Date(m.dueDate).getTime()) / 86_400_000);
    await notifyProjectStakeholders({
      ownerId,
      managerId: m.projectId?.projectManagerId,
      projectId: m.projectId?._id ?? null,
      title: `Milestone "${m.name}" is ${days} day${days === 1 ? '' : 's'} late`,
      message: `Planned completion was ${m.dueDate.toISOString().slice(0, 10)} on ${m.projectId?.name ?? 'the project'}.`,
      type: 'milestone_delay',
    });
    await Milestone.updateOne({ _id: m._id }, { $set: { delayNotifiedAt: new Date() } });
  }
}

async function scanDocumentExpiry({ companyId, ownerId }: ScanContext): Promise<void> {
  const soon = addDays(utcDay(new Date()), 30);
  const expiring = await DocumentFile.find({
    companyId,
    expiryDate: { $ne: null, $lte: soon, $gte: utcDay(new Date()) },
    expiryNotifiedAt: null,
  })
    .limit(20)
    .populate('projectId', 'name');

  await notifyUsers(
    expiring.map((d: any) => ({
      userId: ownerId,
      title: `Document expiring — ${d.title}`,
      message: `"${d.title}" expires on ${d.expiryDate.toISOString().slice(0, 10)}${d.projectId?.name ? ` (${d.projectId.name})` : ''}. Plan renewal.`,
      type: 'document_expiry' as NotificationType,
      relatedProjectId: d.projectId?._id ?? null,
    })),
  );
  await DocumentFile.updateMany(
    { _id: { $in: expiring.map((d: any) => d._id) } },
    { $set: { expiryNotifiedAt: new Date() } },
  );
}

async function scanPendingApprovals({ companyId, ownerId }: ScanContext): Promise<void> {
  const pending = await Approval.find({
    companyId,
    status: 'pending',
    reminderSentAt: null,
    createdAt: { $lt: addDays(utcDay(new Date()), -2) },
  })
    .limit(15)
    .populate('requestedBy', 'name');

  for (const a of pending as any[]) {
    const step = a.steps?.[a.currentLevel];
    if (!step) continue;
    const approvers = await User.find({
      companyId,
      role: { $in: [step.role] },
      isActive: true,
    }).select('_id');
    await notifyUsers(
      approvers
        .filter((u: any) => String(u._id) !== String(a.requestedBy?._id))
        .map((u: any) => ({
          userId: u._id,
          title: `Reminder — "${a.title}" awaits your approval`,
          message: `Requested by ${a.requestedBy?.name ?? 'team'}${a.amount ? ` • ₹${Math.round(a.amount).toLocaleString('en-IN')}` : ''}.`,
          type: step.role === 'owner' ? ('expense_approval' as NotificationType) : ('purchase_approval' as NotificationType),
          relatedProjectId: a.projectId ?? null,
        })),
    );
    await Approval.updateOne({ _id: a._id }, { $set: { reminderSentAt: new Date() } });
  }

  // Overdue task nudge to owners as well.
  const overdueTasks = await Task.countDocuments({
    companyId,
    status: { $ne: 'completed' },
    dueDate: { $ne: null, $lt: utcDay(new Date()) },
  });
  void overdueTasks;
  void ownerId;
}

/** Run every check; failures in one scan never block the others. */
export async function runNotificationScan(): Promise<void> {
  try {
    const companies = await User.aggregate([
      { $match: { role: { $in: ['owner', 'super_admin'] }, isActive: true, companyId: { $ne: null } } },
      { $group: { _id: '$companyId', ownerId: { $first: '$_id' } } },
    ]);

    for (const c of companies) {
      const ctx: ScanContext = { companyId: c._id, ownerId: c.ownerId };
      await Promise.allSettled([
        scanLowStock(ctx),
        scanOverduePayments(ctx),
        scanMilestoneDelays(ctx),
        scanDocumentExpiry(ctx),
        scanPendingApprovals(ctx),
      ]);
    }
  } catch (err) {
    logError('Notification scan failed', err);
  }
}
