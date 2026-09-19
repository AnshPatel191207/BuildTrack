import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Payment, nextPaymentNumber } from '../models/Payment';
import { Customer, pushCustomerStage } from '../models/Customer';
import { Booking } from '../models/Booking';
import { Unit } from '../models/Unit';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, addDays, escapeRegex, toObjectId } from '../utils/dates';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listPayments(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canViewReceivables')) {
    throw ApiError.forbidden('You cannot view payments.');
  }
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  }
  if (q.bookingId) filter.bookingId = q.bookingId;
  if (q.customerId) filter.customerId = q.customerId;
  if (q.status) filter.status = q.status;
  if (q.paymentType) filter.paymentType = q.paymentType;
  const today = utcDay(new Date());
  if (q.overdue === 'true') {
    filter.status = 'pending';
    filter.dueDate = { $lt: today };
  }
  if (q.from || q.to) {
    const range: Record<string, unknown> = {};
    if (q.from) range.$gte = utcDay(q.from);
    if (q.to) range.$lte = addDays(utcDay(q.to), 1);
    filter.dueDate = range;
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ paymentNumber: rx }, { reference: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ dueDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customerId', 'name phone')
      .populate('projectId', 'name')
      .populate('bookingId', 'bookingNumber status')
      .populate('unitId', 'unitNumber'),
    Payment.countDocuments(filter),
  ]);

  const now = today.getTime();
  const enriched = items.map((p: any) => ({
    ...p.toJSON(),
    isOverdue:
      p.status === 'pending' && p.dueDate ? new Date(p.dueDate).getTime() < now : false,
  }));
  sendSuccess(res, enriched, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createPayment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePayments')) {
    throw ApiError.forbidden('You cannot record payments.');
  }
  const body = req.validatedBody;

  let booking: any = null;
  if (body.bookingId) {
    booking = await Booking.findOne({ _id: body.bookingId, companyId: user.companyId });
    if (!booking) throw ApiError.badRequest('Booking not found.');
    if (body.projectId && String(booking.projectId) !== String(body.projectId)) {
      throw ApiError.badRequest('This booking belongs to a different project.');
    }
    if (booking.projectId) await assertProjectAccess(user, String(booking.projectId));
    body.projectId = body.projectId ?? booking.projectId;
    if (!body.customerId && booking.customerId) {
      body.customerId = booking.customerId;
    }
  } else if (body.projectId) {
    await assertProjectAccess(user, body.projectId);
  }

  const customer = await Customer.findOne({ _id: body.customerId, companyId: user.companyId });
  if (!customer) throw ApiError.badRequest('Customer not found.');

  const paidNow = Boolean(body.paidDate);
  const payment = await Payment.create({
    ...body,
    companyId: user.companyId,
    projectId: body.projectId || null,
    bookingId: body.bookingId || null,
    unitId: booking?.unitId || null,
    customerId: customer._id,
    paymentNumber: await nextPaymentNumber(user.companyId),
    status: paidNow ? 'paid' : (body.status || 'pending'),
    paidDate: paidNow ? utcDay(body.paidDate) : null,
    recordedBy: user._id,
  });

  if (paidNow) {
    await pushCustomerStage(customer._id, 'payment', `Payment ${payment.paymentNumber} received`);
    // Auto-mark the sale once a confirmed booking is fully paid.
    if (booking && ['confirmed'].includes(booking.status)) {
      const paidAgg = await Payment.aggregate([
        { $match: { bookingId: booking._id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const totalPaid = paidAgg[0]?.total ?? 0;
      if (totalPaid >= booking.totalValue) {
        booking.status = 'sold';
        await booking.save();
        const unit = await Unit.findById(booking.unitId);
        if (unit) {
          unit.status = 'sold';
          await unit.save();
        }
      }
    }
  }

  await logAudit(req, {
    action: paidNow ? 'payment_received' : 'create',
    module: 'payments',
    entityType: 'payment',
    entityId: payment._id,
    description: `${user.name} recorded ${paidNow ? 'payment' : 'due'} ${payment.paymentNumber} of ₹${Math.round(payment.amount).toLocaleString('en-IN')}`,
    meta: { customerId: customer._id, amount: payment.amount },
  });
  sendCreated(res, payment, paidNow ? `Payment of ₹${Math.round(payment.amount).toLocaleString('en-IN')} recorded.` : 'Payment due added to schedule.');
}

export async function getPayment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const payment = await Payment.findById(req.params.id)
    .populate('customerId', 'name phone email')
    .populate('projectId', 'name')
    .populate('bookingId', 'bookingNumber')
    .populate('recordedBy', 'name');
  if (!payment || !payment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Payment not found.');
  }
  sendSuccess(res, payment);
}

export async function updatePayment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePayments')) {
    throw ApiError.forbidden('You cannot edit payments.');
  }
  const payment = await Payment.findById(req.params.id);
  if (!payment || !payment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Payment not found.');
  }
  const body = req.validatedBody;
  Object.assign(payment, {
    ...body,
    dueDate: body.dueDate === undefined ? payment.dueDate : body.dueDate ? utcDay(body.dueDate) : null,
    paidDate:
      body.paidDate === undefined ? payment.paidDate : body.paidDate ? utcDay(body.paidDate) : null,
  });
  await payment.save();
  await logAudit(req, {
    action: 'update',
    module: 'payments',
    entityType: 'payment',
    entityId: payment._id,
    description: `${user.name} updated payment ${payment.paymentNumber}`,
  });
  sendSuccess(res, payment, 'Payment updated.');
}

/** Mark a pending entry as received — generates receipt number history. */
export async function markPaymentPaid(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePayments')) {
    throw ApiError.forbidden('You cannot record payments.');
  }
  const payment = await Payment.findById(req.params.id);
  if (!payment || !payment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Payment not found.');
  }
  if (payment.status !== 'pending') {
    throw ApiError.badRequest(`This payment is already ${payment.status}.`);
  }
  const { paidDate, method, reference } = req.validatedBody ?? {};
  payment.status = 'paid';
  payment.paidDate = utcDay(paidDate ?? new Date().toISOString().slice(0, 10));
  if (method) payment.method = method;
  if (reference) payment.reference = reference;
  await payment.save();

  const customer = await Customer.findById(payment.customerId).select('name');
  if (customer) {
    await pushCustomerStage(payment.customerId, 'payment', `Payment ${payment.paymentNumber} received`);
  }

  // Fully-paid bookings complete their sale automatically.
  if (payment.bookingId) {
    const booking = await Booking.findById(payment.bookingId);
    if (booking && booking.status === 'confirmed') {
      const paidAgg = await Payment.aggregate([
        { $match: { bookingId: booking._id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      if ((paidAgg[0]?.total ?? 0) >= booking.totalValue) {
        booking.status = 'sold';
        await booking.save();
        await Unit.updateOne({ _id: booking.unitId }, { $set: { status: 'sold' } });
      }
    }
  }

  await logAudit(req, {
    action: 'payment_received',
    module: 'payments',
    entityType: 'payment',
    entityId: payment._id,
    description: `${user.name} marked ${payment.paymentNumber} as received (₹${Math.round(payment.amount).toLocaleString('en-IN')})`,
  });
  sendSuccess(res, payment, `₹${Math.round(payment.amount).toLocaleString('en-IN')} marked as received.`);
}

export async function deletePayment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManagePayments')) {
    throw ApiError.forbidden('You cannot delete payments.');
  }
  const payment = await Payment.findById(req.params.id);
  if (!payment || !payment.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Payment not found.');
  }
  if (payment.status === 'paid' || payment.receiptNumber) {
    throw ApiError.badRequest(
      'Cannot delete a payment that is already marked as paid or has an issued receipt. Financial transactions are immutable.',
    );
  }
  await payment.deleteOne();
  await logAudit(req, {
    action: 'delete',
    module: 'payments',
    entityType: 'payment',
    entityId: payment._id,
    description: `${user.name} deleted payment ${payment.paymentNumber}`,
  });
  sendSuccess(res, { id: payment._id }, 'Payment deleted.');
}

/** GET /api/payments/receivables — Module 8 dashboard. */
export async function receivablesDashboard(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const match: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) match.projectId = toObjectId(q.projectId);

  const today = utcDay(new Date());
  const in7Days = addDays(today, 7);

  const [totals, overdueRows, upcomingRows, byCustomer] = await Promise.all([
    Payment.aggregate([
      { $match: { ...match, status: 'pending' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...match,
          status: 'pending',
          dueDate: { $ne: null, $lt: today },
        },
      },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.find({
      ...match,
      status: 'pending',
      dueDate: { $ne: null, $gte: today, $lte: in7Days },
    })
      .sort({ dueDate: 1 })
      .limit(15)
      .populate('customerId', 'name phone')
      .populate('projectId', 'name')
      .populate('unitId', 'unitNumber'),
    Payment.aggregate([
      { $match: { ...match, status: 'pending' } },
      {
        $group: {
          _id: '$customerId',
          outstanding: { $sum: '$amount' },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$dueDate', null] }, { $lt: ['$dueDate', today] }] },
                '$amount',
                0,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { outstanding: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const customerIds = byCustomer.map((c: any) => c._id);
  const customers = await Customer.find({ _id: { $in: customerIds } }).select('name phone');
  const customerMap = new Map(customers.map((c: any) => [String(c._id), c]));

  sendSuccess(res, {
    totalReceivable: totals[0]?.amount ?? 0,
    pendingCount: totals[0]?.count ?? 0,
    overdueAmount: overdueRows[0]?.amount ?? 0,
    overdueCount: overdueRows[0]?.count ?? 0,
    upcoming: upcomingRows.map((p: any) => ({
      ...p.toJSON(),
      daysUntilDue: Math.ceil(
        (new Date(p.dueDate).getTime() - today.getTime()) / 86_400_000,
      ),
    })),
    customerWise: byCustomer.map((c: any) => ({
      customer: customerMap.get(String(c._id)),
      outstanding: Math.round(c.outstanding),
      overdue: Math.round(c.overdue),
      count: c.count,
    })),
  });
}
