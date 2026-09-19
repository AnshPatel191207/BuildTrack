import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Booking, nextBookingNumber } from '../models/Booking';
import { Unit } from '../models/Unit';
import { Customer, pushCustomerStage } from '../models/Customer';
import { Payment } from '../models/Payment';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, escapeRegex } from '../utils/dates';
import { logAudit } from '../utils/audit';
import { notifyUsers } from '../services/notification.service';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

async function getCompanyOwnerId(companyId: unknown): Promise<unknown | null> {
  const Company = (await import('../models/Company.js')).Company;
  const company = await Company.findById(companyId).select('ownerId');
  return company?.ownerId ?? null;
}

export async function listBookings(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  }
  if (q.status) {
    const statuses = String(q.status)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (statuses.length > 1) {
      filter.status = { $in: statuses };
    } else if (statuses.length === 1) {
      filter.status = statuses[0];
    }
  }
  if (q.customerId) filter.customerId = q.customerId;
  if (q.salesManagerId) filter.salesManagerId = q.salesManagerId;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ bookingNumber: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .sort({ bookingDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name')
      .populate('unitId', 'unitNumber unitType totalValue')
      .populate('customerId', 'name phone')
      .populate('salesManagerId', 'name'),
    Booking.countDocuments(filter),
  ]);

  // Attach paid/outstanding summaries in bulk.
  const ids = items.map((b: any) => b._id);
  const sums = await Payment.aggregate([
    { $match: { bookingId: { $in: ids }, status: 'paid' } },
    { $group: { _id: '$bookingId', paid: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const sumMap = new Map<string, { paid?: number; count?: number }>(sums.map((s: any) => [String(s._id), s] as [string, any]));
  const enriched = items.map((b: any) => {
    const s = sumMap.get(String(b._id));
    const paid = s?.paid ?? 0;
    return {
      ...b.toJSON(),
      paidAmount: Math.round(paid),
      outstanding: Math.max(Math.round(b.totalValue - paid), 0),
      paymentCount: s?.count ?? 0,
    };
  });

  sendSuccess(res, enriched, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createBooking(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageBookings')) {
    throw ApiError.forbidden('You cannot manage bookings.');
  }
  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const unit = await Unit.findOne({ _id: body.unitId, companyId: user.companyId });
  if (!unit || String(unit.projectId) !== String(body.projectId)) {
    throw ApiError.badRequest('Unit not found in this project.');
  }
  if (!['available', 'reserved'].includes(unit.status)) {
    throw ApiError.conflict(`Unit ${unit.unitNumber} is already ${unit.status}.`);
  }
  const customer = await Customer.findOne({ _id: body.customerId, companyId: user.companyId });
  if (!customer) throw ApiError.badRequest('Customer not found.');

  if (unit.totalValue === 0 && body.totalAmount) {
    unit.totalValue = Number(body.totalAmount);
    await unit.save();
  }

  const effectiveTotalValue = unit.totalValue || Number(body.totalAmount) || 0;
  const bookingAmount = body.bookingAmount !== undefined ? Number(body.bookingAmount) : (Number(body.tokenAmount) || 0);

  if (effectiveTotalValue > 0 && bookingAmount > effectiveTotalValue) {
    throw ApiError.badRequest('Booking amount cannot exceed the unit value.');
  }

  const bookingNumber = await nextBookingNumber(user.companyId);
  const booking = await Booking.create({
    ...body,
    bookingDate: body.bookingDate ? new Date(body.bookingDate) : new Date(),
    bookingAmount,
    companyId: user.companyId,
    bookingNumber,
    totalValue: effectiveTotalValue,
    salesManagerId: body.salesManagerId || user._id,
    createdBy: user._id,
    status: 'pending',
  });

  // Reserve the unit while approval is pending.
  unit.status = 'reserved';
  unit.currentCustomerId = customer._id;
  unit.currentBookingId = booking._id;
  await unit.save();

  // Booking approval chain: Sales Manager → Owner. The requester clears
  // their own level automatically.
  const { Approval, APPROVAL_CHAINS } = await import('../models/Approval.js');
  const requesterRole = String(user.role);
  const steps = APPROVAL_CHAINS.booking.map((role: string, i: number) => ({
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

  await Approval.create({
    companyId: user.companyId,
    projectId: booking.projectId,
    entityType: 'booking',
    entityId: booking._id,
    title: `Booking ${bookingNumber} — ${customer.name} / ${unit.unitNumber}`,
    amount: unit.totalValue,
    requestedBy: user._id,
    steps,
    currentLevel: finalLevel,
    status: finalLevel >= steps.length ? 'approved' : 'pending',
    completedAt: finalLevel >= steps.length ? new Date() : null,
  });

  const ownerId = await getCompanyOwnerId(user.companyId);
  await notifyUsers(
    [
      ownerId,
      booking.salesManagerId,
    ]
      .filter((id) => id && String(id) !== String(user._id))
      .map((userId) => ({
        userId,
        title: `New booking ${bookingNumber} needs approval`,
        message: `${customer.name} booked ${unit.unitNumber} (${booking.totalValue.toLocaleString('en-IN')}).`,
        type: 'new_booking' as const,
        relatedProjectId: booking.projectId,
      })),
  );

  await logAudit(req, {
    action: 'create',
    module: 'bookings',
    entityType: 'booking',
    entityId: booking._id,
    description: `${user.name} created booking ${bookingNumber} for ${customer.name}`,
    meta: { unitId: unit._id, amount: unit.totalValue },
  });
  sendCreated(res, booking, `Booking ${bookingNumber} created and sent for approval.`);
}

export async function getBooking(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const booking = await Booking.findById(req.params.id)
    .populate('projectId', 'name')
    .populate('unitId')
    .populate('customerId')
    .populate('salesManagerId', 'name');
  if (!booking || !booking.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Booking not found.');
  }
  const payments = await Payment.find({ bookingId: booking._id })
    .sort({ dueDate: 1, createdAt: 1 })
    .populate('recordedBy', 'name');

  const paid = payments
    .filter((p: any) => p.status === 'paid')
    .reduce((s: number, p: any) => s + p.amount, 0);
  const today = utcDay(new Date());
  const overdue = payments
    .filter((p: any) => p.status === 'pending' && p.dueDate && p.dueDate < today)
    .reduce((s: number, p: any) => s + p.amount, 0);

  sendSuccess(res, {
    booking,
    payments,
    summary: {
      totalValue: booking.totalValue,
      paidAmount: Math.round(paid),
      outstanding: Math.max(booking.totalValue - paid, 0),
      overdueAmount: Math.round(overdue),
    },
  });
}

/** confirm → unit booked + schedule; cancel → release unit. */
export async function bookingAction(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageBookings')) {
    throw ApiError.forbidden('You cannot manage bookings.');
  }
  const booking = await Booking.findById(req.params.id);
  if (!booking || !booking.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Booking not found.');
  }
  const { action, cancellationReason, possessionDate } = req.validatedBody;
  const unit = await Unit.findById(booking.unitId);

  switch (action) {
    case 'confirm': {
      if (booking.status !== 'pending') {
        throw ApiError.badRequest(`Only pending bookings can be confirmed.`);
      }
      booking.status = 'confirmed';
      if (unit) {
        unit.status = 'booked';
        await unit.save();
      }
      await pushCustomerStage(booking.customerId, 'booking', `Booking ${booking.bookingNumber} confirmed`);
      break;
    }
    case 'cancel': {
      if (['cancelled', 'sold'].includes(booking.status)) {
        throw ApiError.badRequest('This booking is already closed.');
      }
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationReason = cancellationReason || null;
      await Payment.updateMany(
        { bookingId: booking._id, status: 'pending' },
        { $set: { status: 'cancelled' } },
      );
      if (unit) {
        unit.status = 'available';
        unit.currentCustomerId = null;
        unit.currentBookingId = null;
        await unit.save();
      }
      break;
    }
    case 'mark_sold': {
      if (!['confirmed', 'sold'].includes(booking.status)) {
        throw ApiError.badRequest('Confirm the booking before marking it sold.');
      }
      booking.status = 'sold';
      if (unit) {
        unit.status = 'sold';
        await unit.save();
      }
      await pushCustomerStage(booking.customerId, 'payment', `Unit ${unit?.unitNumber ?? ''} fully sold`);
      break;
    }
    case 'mark_possession': {
      if (booking.status !== 'sold') {
        throw ApiError.badRequest('Mark the sale complete before handing over possession.');
      }
      booking.possessionDate = possessionDate ? utcDay(possessionDate) : utcDay(new Date());
      await pushCustomerStage(
        booking.customerId,
        'possession',
        `Possession of ${unit?.unitNumber ?? 'unit'} on ${booking.possessionDate.toISOString().slice(0, 10)}`,
      );
      break;
    }
  }

  await booking.save();
  await logAudit(req, {
    action: 'status_change',
    module: 'bookings',
    entityType: 'booking',
    entityId: booking._id,
    description: `${user.name} set booking ${booking.bookingNumber} to ${action}`,
  });
  sendSuccess(res, booking, `Booking ${booking.bookingNumber} updated.`);
}

/** Generate an equal monthly installment schedule for the balance amount. */
export async function generateSchedule(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePayments')) {
    throw ApiError.forbidden('You cannot manage payment schedules.');
  }
  const booking = await Booking.findById(req.params.id).populate('unitId', 'unitNumber');
  if (!booking || !booking.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Booking not found.');
  }
  if (['cancelled'].includes(booking.status)) {
    throw ApiError.badRequest('Cannot schedule payments for a cancelled booking.');
  }

  const { installments = 1, startDate = new Date().toISOString().slice(0, 10), frequencyMonths = 1, milestones } = req.validatedBody ?? req.body ?? {};
  await Payment.deleteMany({ bookingId: booking._id, status: 'pending' });

  // Allocate receipt numbers locally — countDocuments doesn't see the docs
  // until insertMany runs, so sequential awaits would collide.
  let seq = await Payment.countDocuments({ companyId: booking.companyId });
  const takePaymentNumber = (): string => {
    seq += 1;
    return `PAY-${String(seq).padStart(4, '0')}`;
  };

  if (Array.isArray(milestones) && milestones.length > 0) {
    const milestoneDocs: any[] = [];
    for (const m of milestones) {
      milestoneDocs.push({
        companyId: booking.companyId,
        projectId: booking.projectId,
        bookingId: booking._id,
        customerId: booking.customerId,
        unitId: booking.unitId,
        paymentNumber: takePaymentNumber(),
        amount: Number(m.amount || 0),
        paymentType: 'milestone',
        method: 'bank_transfer',
        dueDate: m.dueDate ? utcDay(m.dueDate) : utcDay(new Date()),
        notes: m.name || m.milestoneName || m.description || undefined,
        status: 'pending',
        recordedBy: user._id,
      });
    }
    if (milestoneDocs.length > 0) await Payment.insertMany(milestoneDocs);
    sendCreated(res, { created: milestoneDocs.length }, `Payment schedule with ${milestoneDocs.length} milestones generated.`);
    return;
  }

  const paidAgg = await Payment.aggregate([
    { $match: { bookingId: booking._id, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const alreadyPaid = paidAgg[0]?.total ?? 0;

  const docs: any[] = [];
  if (alreadyPaid < booking.bookingAmount || alreadyPaid === 0) {
    const bookingDue = Math.max(booking.bookingAmount - alreadyPaid, 0);
    if (bookingDue > 0) {
      docs.push({
        companyId: booking.companyId,
        projectId: booking.projectId,
        bookingId: booking._id,
        customerId: booking.customerId,
        unitId: booking.unitId,
        paymentNumber: takePaymentNumber(),
        amount: bookingDue,
        paymentType: 'booking_amount',
        method: 'bank_transfer',
        dueDate: utcDay(startDate),
        status: 'pending',
        recordedBy: user._id,
      });
    }
  }

  const remaining = booking.totalValue - Math.max(alreadyPaid, booking.bookingAmount);
  const perInstallment = Math.floor((remaining / installments) * 100) / 100;
  for (let i = 1; i <= installments; i += 1) {
    const isLast = i === installments;
    const amount = isLast
      ? Math.round((remaining - perInstallment * (installments - 1)) * 100) / 100
      : perInstallment;
    const due = utcDay(startDate);
    due.setUTCMonth(due.getUTCMonth() + frequencyMonths * i);
    docs.push({
      companyId: booking.companyId,
      projectId: booking.projectId,
      bookingId: booking._id,
      customerId: booking.customerId,
      unitId: booking.unitId,
      paymentNumber: takePaymentNumber(),
      amount: Math.max(amount, 0),
      paymentType: isLast ? 'final' : 'installment',
      method: 'bank_transfer',
      dueDate: due,
      status: 'pending',
      recordedBy: user._id,
    });
  }

  await Payment.insertMany(docs);
  await logAudit(req, {
    action: 'create',
    module: 'payments',
    entityType: 'booking',
    entityId: booking._id,
    description: `${user.name} generated a ${installments}-step payment plan for ${booking.bookingNumber}`,
  });
  const payments = await Payment.find({ bookingId: booking._id }).sort({ dueDate: 1 });
  sendSuccess(res, payments, `Payment schedule created — ${docs.length} entries.`);
}

export async function deleteBooking(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageBookings')) {
    throw ApiError.forbidden('You cannot manage bookings.');
  }
  const booking = await Booking.findById(req.params.id);
  if (!booking || !booking.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Booking not found.');
  }

  // Delete associated payments, approvals, and release the unit back to available status
  await Promise.all([
    Payment.deleteMany({ bookingId: booking._id }),
    import('../models/Approval.js').then(({ Approval }) =>
      Approval.deleteMany({ entityType: 'booking', entityId: booking._id }),
    ),
    Unit.updateMany(
      { $or: [{ currentBookingId: booking._id }, { _id: booking.unitId }] },
      { $set: { status: 'available', currentCustomerId: null, currentBookingId: null } },
    ),
  ]);
  await booking.deleteOne();
  await logAudit(req, {
    action: 'delete',
    module: 'bookings',
    entityType: 'booking',
    entityId: booking._id,
    description: `${user.name} deleted booking ${booking.bookingNumber} (status was ${booking.status})`,
  });
  sendSuccess(res, { id: booking._id }, `Booking ${booking.bookingNumber || ''} deleted and unit released to available.`);
}
