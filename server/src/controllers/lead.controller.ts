import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Lead } from '../models/Lead';
import { utcDay, addDays, startOfMonthUtc, escapeRegex, toObjectId } from '../utils/dates';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

export async function listLeads(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) filter.projectId = q.projectId;
  if (q.stage) filter.stage = q.stage;
  if (q.source) filter.source = q.source;
  if (q.assignedTo) filter.assignedTo = q.assignedTo;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { interestedIn: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    Lead.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name')
      .populate('customerId', 'name'),
    Lead.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createLead(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageLeads')) {
    throw ApiError.forbidden('You cannot manage leads.');
  }
  const body = req.validatedBody;
  const lead = await Lead.create({
    ...body,
    companyId: user.companyId,
    projectId: body.projectId || null,
    assignedTo: body.assignedTo || user._id,
    nextFollowUpDate: body.nextFollowUpDate ? utcDay(body.nextFollowUpDate) : null,
  });

  await logAudit(req, {
    action: 'create',
    module: 'sales',
    entityType: 'lead',
    entityId: lead._id,
    description: `${user.name} created lead ${lead.name}`,
  });
  sendCreated(res, lead, `Lead "${lead.name}" created.`);
}

export async function getLead(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const lead = await Lead.findById(req.params.id)
    .populate('projectId', 'name')
    .populate('assignedTo', 'name role')
    .populate('customerId', 'name phone')
    .populate('bookingId', 'bookingNumber status')
    .populate('notes.author', 'name');
  if (!lead || !lead.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Lead not found.');
  }
  sendSuccess(res, lead);
}

export async function updateLead(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageLeads')) {
    throw ApiError.forbidden('You cannot manage leads.');
  }
  const lead = await Lead.findById(req.params.id);
  if (!lead || !lead.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Lead not found.');
  }
  const body = req.validatedBody;
  if (body.stage === 'lost' && !body.lostReason && !lead.lostReason) {
    throw ApiError.badRequest('Add a short reason when marking a lead lost.');
  }
  Object.assign(lead, {
    ...body,
    projectId: body.projectId === undefined ? lead.projectId : body.projectId || null,
    assignedTo: body.assignedTo === undefined ? lead.assignedTo : body.assignedTo || null,
    nextFollowUpDate:
      body.nextFollowUpDate === undefined
        ? lead.nextFollowUpDate
        : body.nextFollowUpDate
          ? utcDay(body.nextFollowUpDate)
          : null,
  });
  await lead.save();

  await logAudit(req, {
    action: 'update',
    module: 'sales',
    entityType: 'lead',
    entityId: lead._id,
    description: `${user.name} moved lead ${lead.name} to ${String(body.stage ?? lead.stage).replace(/_/g, ' ')}`,
  });
  sendSuccess(res, lead, 'Lead updated.');
}

export async function deleteLead(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageLeads')) {
    throw ApiError.forbidden('You cannot manage leads.');
  }
  const lead = await Lead.findById(req.params.id);
  if (!lead || !lead.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Lead not found.');
  }
  await lead.deleteOne();
  await logAudit(req, {
    action: 'delete',
    module: 'sales',
    entityType: 'lead',
    entityId: lead._id,
    description: `${user.name} deleted lead ${lead.name}`,
  });
  sendSuccess(res, { id: lead._id }, 'Lead deleted.');
}

/** Schedule the next follow-up call/visit. */
export async function addFollowUp(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const lead = await Lead.findById(req.params.id);
  if (!lead || !lead.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Lead not found.');
  }
  const body = req.validatedBody;
  lead.followUps.push({ date: utcDay(body.date), note: body.note, done: false });
  lead.nextFollowUpDate = utcDay(body.date);
  await lead.save();
  sendSuccess(res, lead, `Follow-up scheduled for ${body.date}.`);
}

export async function completeFollowUp(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const lead = await Lead.findById(req.params.id);
  if (!lead || !lead.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Lead not found.');
  }
  const { index } = req.body as { index?: number };
  const target =
    index != null && lead.followUps[index]
      ? lead.followUps[index]
      : [...lead.followUps].reverse().find((f: any) => !f.done);
  if (!target) throw ApiError.badRequest('No pending follow-up found.');
  (target as any).done = true;
  if (
    lead.nextFollowUpDate &&
    new Date(target.date).getTime() === new Date(lead.nextFollowUpDate).getTime()
  ) {
    const pending = lead.followUps.filter((f: any) => !f.done);
    lead.nextFollowUpDate = pending.length
      ? pending.map((f: any) => f.date).sort()[0]
      : null;
  }
  await lead.save();
  sendSuccess(res, lead, 'Follow-up completed.');
}

export async function addNote(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const lead = await Lead.findById(req.params.id);
  if (!lead || !lead.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Lead not found.');
  }
  lead.notes.push({ text: req.validatedBody.text, author: user._id, createdAt: new Date() });
  await lead.save();
  await lead.populate('notes.author', 'name');
  sendSuccess(res, lead, 'Note added.');
}

/** Link a converted booking back to this lead and close it out. */
export async function convertLead(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageLeads')) {
    throw ApiError.forbidden('You cannot manage leads.');
  }
  const lead = await Lead.findById(req.params.id);
  if (!lead || !lead.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Lead not found.');
  }
  const { customerId } = req.validatedBody;
  const customer = await import('../models/Customer').then(({ Customer }) =>
    Customer.findOne({ _id: customerId, companyId: user.companyId }),
  );
  if (!customer) throw ApiError.badRequest('Customer not found for conversion.');

  lead.customerId = customer._id;
  lead.stage = 'booked';
  await lead.save();
  await import('../models/Customer').then(async ({ pushCustomerStage }) => {
    await pushCustomerStage(customer._id, 'inquiry', `Converted from lead ${lead.name}`);
  });

  await logAudit(req, {
    action: 'update',
    module: 'sales',
    entityType: 'lead',
    entityId: lead._id,
    description: `${user.name} linked ${customer.name}'s booking to lead ${lead.name}`,
  });
  sendSuccess(res, lead, `${lead.name} marked as booked.`);
}

/** GET /api/leads/sales-dashboard — Module 5 metrics. */
export async function salesDashboard(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const match: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) match.projectId = toObjectId(q.projectId);

  const monthStart = startOfMonthUtc();
  const monthEnd = addDays(monthStart, 31);

  const [totalOpen, newThisMonth, bookedTotal, bookedThisMonth, lostThisMonth, byStage, revenueAgg, topSources] =
    await Promise.all([
      Lead.countDocuments({ ...match, stage: { $nin: ['booked', 'lost'] } }),
      Lead.countDocuments({ ...match, createdAt: { $gte: monthStart, $lt: monthEnd } }),
      Lead.countDocuments({ ...match, stage: 'booked' }),
      Lead.countDocuments({ ...match, stage: 'booked', updatedAt: { $gte: monthStart, $lt: monthEnd } }),
      Lead.countDocuments({ ...match, stage: 'lost', updatedAt: { $gte: monthStart, $lt: monthEnd } }),
      Lead.aggregate([
        { $match: match },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { ...match, stage: 'booked' } },
        { $group: { _id: null, revenue: { $sum: '$convertedValue' }, count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: match },
        { $group: { _id: '$source', count: { $sum: 1 }, won: { $sum: { $cond: [{ $eq: ['$stage', 'booked'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

  const closedWon = bookedTotal;
  const closedAll = closedWon + lostThisMonth + Math.max(bookedTotal - bookedThisMonth, 0);
  const conversionRate = closedAll > 0 ? Math.round((closedWon / closedAll) * 1000) / 10 : 0;

  const today = utcDay(new Date());
  const upcomingFollowUps = await Lead.find({
    ...match,
    stage: { $nin: ['booked', 'lost'] },
    nextFollowUpDate: { $ne: null, $lte: addDays(today, 7) },
  })
    .sort({ nextFollowUpDate: 1 })
    .limit(10)
    .select('name phone stage nextFollowUpDate projectId')
    .populate('projectId', 'name');

  sendSuccess(res, {
    openLeads: totalOpen,
    leadsThisMonth: newThisMonth,
    conversionsThisMonth: bookedThisMonth,
    totalConversions: bookedTotal,
    lostThisMonth,
    revenueBooked: revenueAgg[0]?.revenue ?? 0,
    conversionRate,
    byStage: byStage.map((s: any) => ({ stage: s._id, count: s.count })),
    topSources: topSources.map((s: any) => ({ source: s._id, count: s.count, won: s.won })),
    upcomingFollowUps,
  });
}
