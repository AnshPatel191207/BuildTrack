import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Customer, pushCustomerStage } from '../models/Customer';
import { escapeRegex } from '../utils/dates';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listCustomers(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) filter.projectId = q.projectId;
  if (q.leadSource) filter.leadSource = q.leadSource;
  if (q.journeyStage) filter.journeyStage = q.journeyStage;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { city: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    Customer.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name'),
    Customer.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createCustomer(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageCustomers')) {
    throw ApiError.forbidden('You cannot manage customers.');
  }
  const body = req.validatedBody;
  const duplicate = await Customer.findOne({
    companyId: user.companyId,
    phone: body.phone,
  });
  if (duplicate) {
    throw ApiError.conflict(`A customer with phone ${body.phone} already exists.`);
  }
  const customer = await Customer.create({
    ...body,
    companyId: user.companyId,
    projectId: body.projectId || null,
    assignedTo: body.assignedTo || null,
    timeline: [{ stage: body.journeyStage ?? 'inquiry', note: 'Customer created', date: new Date() }],
  });

  await logAudit(req, {
    action: 'create',
    module: 'crm',
    entityType: 'customer',
    entityId: customer._id,
    description: `${user.name} added customer ${customer.name}`,
  });
  sendCreated(res, customer, `${customer.name} added to your customers.`);
}

export async function getCustomer(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const customer = await Customer.findById(req.params.id)
    .populate('projectId', 'name')
    .populate('assignedTo', 'name role');
  if (!customer || !customer.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Customer not found.');
  }
  const { Booking } = await import('../models/Booking.js');
  const bookings = await Booking.find({ customerId: customer._id })
    .select('bookingNumber status bookingDate totalValue bookingAmount unitId')
    .populate('unitId', 'unitNumber unitType')
    .sort({ bookingDate: -1 });
  sendSuccess(res, { customer, bookings });
}

export async function updateCustomer(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageCustomers')) {
    throw ApiError.forbidden('You cannot manage customers.');
  }
  const customer = await Customer.findById(req.params.id);
  if (!customer || !customer.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Customer not found.');
  }
  const body = req.validatedBody;
  const previousStage = customer.journeyStage;
  Object.assign(customer, {
    ...body,
    projectId: body.projectId === undefined ? customer.projectId : body.projectId || null,
    assignedTo: body.assignedTo === undefined ? customer.assignedTo : body.assignedTo || null,
  });
  if (body.journeyStage && body.journeyStage !== previousStage) {
    customer.timeline.push({ stage: body.journeyStage, note: 'Stage updated', date: new Date() });
  }
  await customer.save();

  await logAudit(req, {
    action: 'update',
    module: 'crm',
    entityType: 'customer',
    entityId: customer._id,
    description: `${user.name} updated customer ${customer.name}`,
  });
  sendSuccess(res, customer, 'Customer updated.');
}

export async function deleteCustomer(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageCustomers')) {
    throw ApiError.forbidden('You cannot manage customers.');
  }
  const customer = await Customer.findById(req.params.id);
  if (!customer || !customer.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Customer not found.');
  }
  const { Booking } = await import('../models/Booking.js');
  const { Payment } = await import('../models/Payment.js');
  const { Unit } = await import('../models/Unit.js');

  // Release any units currently booked or owned by this customer
  await Unit.updateMany(
    { currentCustomerId: customer._id },
    { $set: { status: 'available', currentCustomerId: null, currentBookingId: null } },
  );

  // Clean up customer bookings and payments
  await Promise.all([
    Booking.deleteMany({ customerId: customer._id }),
    Payment.deleteMany({ customerId: customer._id }),
  ]);

  await customer.deleteOne();
  await logAudit(req, {
    action: 'delete',
    module: 'crm',
    entityType: 'customer',
    entityId: customer._id,
    description: `${user.name} deleted customer ${customer.name}`,
  });
  sendSuccess(res, { id: customer._id }, 'Customer deleted.');
}

/** Record a journey milestone against a customer. */
export async function addTimelineEvent(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const customer = await Customer.findById(req.params.id);
  if (!customer || !customer.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Customer not found.');
  }
  const { stage, note } = req.validatedBody as { stage: string; note?: string };
  const { pushCustomerStage } = await import('../models/Customer.js');
  await pushCustomerStage(customer._id, stage as any, note);
  const updated = await Customer.findById(customer._id).populate('projectId', 'name');
  sendSuccess(res, updated, `Journey updated to "${stage}".`);
}
