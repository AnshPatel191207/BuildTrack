import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import {
  Contractor,
  ContractorContract,
  ContractorPayment,
} from '../models/Contractor';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, escapeRegex } from '../utils/dates';
import { logAudit } from '../utils/audit';
import { notifyUsers } from '../services/notification.service';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

// ── Contractor master ────────────────────────────────────────────

export async function listContractors(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.workType) filter.workTypes = q.workType;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { companyName: rx }, { specialty: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 20, 100);
  const [items, total] = await Promise.all([
    Contractor.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Contractor.countDocuments(filter),
  ]);

  // Aggregate contract value/pending per contractor.
  const contractorIds = items.map((c: any) => c._id);
  const stats = await ContractorContract.aggregate([
    { $match: { contractorId: { $in: contractorIds }, status: { $ne: 'terminated' } } },
    {
      $group: {
        _id: '$contractorId',
        contracts: { $sum: 1 },
        totalValue: { $sum: '$contractValue' },
        paid: { $sum: '$paidAmount' },
      },
    },
  ]);
  const statMap = new Map<string, any>(stats.map((s: any) => [String(s._id), s] as [string, any]));
  const enriched = items.map((c: any) => {
    const s = statMap.get(String(c._id));
    return {
      ...c.toJSON(),
      contractCount: s?.contracts ?? 0,
      totalContractValue: Math.round(s?.totalValue ?? 0),
      paidAmount: Math.round(s?.paid ?? 0),
      pendingAmount: Math.round((s?.totalValue ?? 0) - (s?.paid ?? 0)),
    };
  });
  sendSuccess(res, enriched, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createContractor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageContractors')) {
    throw ApiError.forbidden('You cannot manage contractors.');
  }
  const contractor = await Contractor.create({
    ...req.validatedBody,
    companyId: user.companyId,
  });
  await logAudit(req, {
    action: 'create',
    module: 'contractors',
    entityType: 'contractor',
    entityId: contractor._id,
    description: `${user.name} added contractor ${contractor.name}`,
  });
  sendCreated(res, contractor, `${contractor.name} added.`);
}

export async function getContractor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor || !contractor.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Contractor not found.');
  }
  const [contracts, payments] = await Promise.all([
    ContractorContract.find({ contractorId: contractor._id })
      .sort({ createdAt: -1 })
      .populate('projectId', 'name'),
    ContractorPayment.find({ contractorId: contractor._id })
      .sort({ date: -1 })
      .limit(30)
      .populate('projectId', 'name')
      .populate('createdBy', 'name'),
  ]);
  sendSuccess(res, {
    contractor,
    contracts: contracts.map((c: any) => ({
      ...c.toJSON(),
      pendingAmount: Math.max(c.contractValue - c.paidAmount, 0),
    })),
    payments,
  });
}

export async function updateContractor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageContractors')) {
    throw ApiError.forbidden('You cannot manage contractors.');
  }
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor || !contractor.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Contractor not found.');
  }
  Object.assign(contractor, req.validatedBody);
  await contractor.save();
  sendSuccess(res, contractor, 'Contractor updated.');
}

export async function deleteContractor(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageContractors')) {
    throw ApiError.forbidden('You cannot manage contractors.');
  }
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor || !contractor.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Contractor not found.');
  }
  const activeContracts = await ContractorContract.exists({
    contractorId: contractor._id,
    status: 'active',
  });
  if (activeContracts) {
    throw ApiError.badRequest('Close active contracts before removing this contractor.');
  }
  await Promise.all([
    ContractorContract.deleteMany({ contractorId: contractor._id }),
    ContractorPayment.deleteMany({ contractorId: contractor._id }),
  ]);
  await contractor.deleteOne();
  sendSuccess(res, { id: contractor._id }, 'Contractor removed.');
}

// ── Contracts ────────────────────────────────────────────────────

export async function createContract(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageContractors')) {
    throw ApiError.forbidden('You cannot manage contracts.');
  }
  const contractor = await Contractor.findOne({
    _id: req.params.id,
    companyId: user.companyId,
  });
  if (!contractor) throw ApiError.notFound('Contractor not found.');

  const body = req.validatedBody;
  await assertProjectAccess(user, body.projectId);

  const contract = await ContractorContract.create({
    ...body,
    companyId: user.companyId,
    contractorId: contractor._id,
    startDate: body.startDate ? utcDay(body.startDate) : null,
    endDate: body.endDate ? utcDay(body.endDate) : null,
  });

  await logAudit(req, {
    action: 'create',
    module: 'contractors',
    entityType: 'contract',
    entityId: contract._id,
    description: `${user.name} created a ₹${Math.round(contract.contractValue).toLocaleString('en-IN')} contract with ${contractor.name}`,
    meta: { projectId: contract.projectId },
  });
  sendCreated(res, contract, `Contract created for ${contractor.name}.`);
}

export async function updateContract(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageContractors')) {
    throw ApiError.forbidden('You cannot manage contracts.');
  }
  const contract = await ContractorContract.findById(req.params.contractId);
  if (!contract || !contract.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Contract not found.');
  }
  const body = req.validatedBody;
  if (body.status === 'completed' && contract.contractValue > contract.paidAmount) {
    throw ApiError.badRequest(
      `₹${Math.round(contract.contractValue - contract.paidAmount).toLocaleString('en-IN')} is still pending on this contract.`,
    );
  }
  Object.assign(contract, {
    ...body,
    startDate: body.startDate === undefined ? contract.startDate : body.startDate ? utcDay(body.startDate) : null,
    endDate: body.endDate === undefined ? contract.endDate : body.endDate ? utcDay(body.endDate) : null,
  });
  await contract.save();
  sendSuccess(res, contract, 'Contract updated.');
}

export async function deleteContract(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageContractors')) {
    throw ApiError.forbidden('You cannot manage contracts.');
  }
  const contract = await ContractorContract.findById(req.params.contractId);
  if (!contract || !contract.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Contract not found.');
  }
  const paid = await ContractorPayment.exists({ contractId: contract._id });
  if (paid) throw ApiError.badRequest('Delete the recorded payments first.');
  await contract.deleteOne();
  sendSuccess(res, { id: contract._id }, 'Contract deleted.');
}

/** Record advance / running bill / final settlement against a contract. */
export async function recordContractPayment(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageContractors')) {
    throw ApiError.forbidden('You cannot record contract payments.');
  }
  const contract = await ContractorContract.findById(req.params.contractId).populate(
    'contractorId',
    'name',
  );
  if (!contract || !contract.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Contract not found.');
  }
  const body = req.validatedBody;

  const alreadyPaid = contract.paidAmount + body.amount;
  if (alreadyPaid > contract.contractValue && body.paymentType !== 'final_settlement') {
    throw ApiError.badRequest(
      `This payment exceeds the contract value by ₹${Math.round(alreadyPaid - contract.contractValue).toLocaleString('en-IN')}.`,
    );
  }

  const payment = await ContractorPayment.create({
    companyId: user.companyId,
    projectId: contract.projectId,
    contractId: contract._id,
    contractorId: contract.contractorId,
    paymentType: body.paymentType,
    amount: body.amount,
    date: utcDay(body.date),
    method: body.method,
    reference: body.reference,
    notes: body.notes,
    createdBy: user._id,
  });

  contract.paidAmount = Math.round(alreadyPaid * 100) / 100;
  if (body.paymentType === 'final_settlement') {
    contract.status = 'completed';
    contract.paidAmount = contract.contractValue;
    payment.amount =
      contract.contractValue - (alreadyPaid - body.amount) > 0
        ? contract.contractValue - (alreadyPaid - body.amount)
        : body.amount;
  }
  await Promise.all([payment.save(), contract.save()]);

  const ownerId = await import('../models/Company').then(({ Company }) =>
    Company.findById(contract.companyId).select('ownerId').then((c: any) => c?.ownerId),
  );
  await notifyUsers([
    ownerId,
  ].filter(Boolean).map((userId: unknown) => ({
    userId,
    title: `Contractor bill — ${(contract.contractorId as any).name}`,
    message: `${body.paymentType.replace(/_/g, ' ')} of ₹${Math.round(payment.amount).toLocaleString('en-IN')} recorded.`,
    type: 'contractor_bill' as const,
    relatedProjectId: contract.projectId,
  })));

  await logAudit(req, {
    action: 'payment_recorded',
    module: 'contractors',
    entityType: 'contract_payment',
    entityId: payment._id,
    description: `${user.name} recorded a ₹${Math.round(payment.amount).toLocaleString('en-IN')} ${body.paymentType} for ${(contract.contractorId as any).name}`,
    meta: { contractId: contract._id },
  });
  sendCreated(res, payment, `Payment of ₹${Math.round(payment.amount).toLocaleString('en-IN')} recorded.`);
}

/** Outstanding contractor payments across the company. */
export async function contractorOutstanding(_req: Req, res: Response) {
  void _req;
  const rows = await ContractorContract.aggregate([
    { $match: { status: { $ne: 'terminated' } } },
    {
      $group: {
        _id: '$contractorId',
        contractCount: { $sum: 1 },
        totalValue: { $sum: '$contractValue' },
        paid: { $sum: '$paidAmount' },
      },
    },
    { $addFields: { pending: { $subtract: ['$totalValue', '$paid'] } } },
    { $match: { pending: { $gt: 0 } } },
    { $sort: { pending: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: 'contractors',
        localField: '_id',
        foreignField: '_id',
        as: 'contractor',
      },
    },
    { $unwind: '$contractor' },
    {
      $project: {
        _id: '$_id',
        name: '$contractor.name',
        companyName: '$contractor.companyName',
        phone: '$contractor.phone',
        workTypes: '$contractor.workTypes',
        contractCount: 1,
        totalValue: 1,
        paid: 1,
        pending: 1,
      },
    },
  ]);
  sendSuccess(res, rows.map((r: any) => ({
    ...r,
    totalValue: Math.round(r.totalValue),
    paid: Math.round(r.paid),
    pending: Math.round(r.pending),
  })));
}
