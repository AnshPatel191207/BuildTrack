import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { normalizeRole } from '../types';
import { permissionsForRole } from '../utils/permissions';
import type { Request, Response } from 'express';

/** Create the user's company (onboarding step 2). */
export async function createCompany(req: Request, res: Response) {
  const userId = req.user!._id;
  if (req.user!.companyId) {
    throw ApiError.conflict('You already have a company set up.');
  }
  const company = await Company.create({ ...req.body, ownerId: userId });
  await User.findByIdAndUpdate(userId, { companyId: company._id });
  res.status(201).json({
    success: true,
    message: `${company.name} is ready.`,
    data: company,
  });
}

export async function getMyCompany(req: Request, res: Response) {
  if (!req.user!.companyId) {
    throw ApiError.notFound('No company found. Complete onboarding first.');
  }
  const company = await Company.findById(req.user!.companyId);
  if (!company) throw ApiError.notFound('Company not found.');
  sendSuccess(res, company);
}

export async function updateCompany(req: Request, res: Response) {
  if (!req.user!.companyId) {
    throw ApiError.notFound('No company found.');
  }
  const company = await Company.findByIdAndUpdate(req.user!.companyId, req.body, {
    new: true,
    runValidators: true,
  });
  sendSuccess(res, company, 'Company updated successfully.');
}

export async function listTeamMembers(req: Request, res: Response) {
  const users = await User.find({ companyId: req.user!.companyId })
    .populate('assignedProjects', 'name status')
    .sort({ createdAt: -1 });
  sendSuccess(res, users);
}

export async function createTeamMember(req: Request, res: Response) {
  const email = req.body.email;
  const exists = await User.findOne({ email });
  if (exists) throw ApiError.conflict('An account with this email already exists.');

  const role = normalizeRole(String(req.body.role));
  if (['super_admin', 'owner'].includes(role)) {
    throw ApiError.forbidden('Company owners cannot create elevated accounts.');
  }

  const passwordHash = await User.hashPassword(req.body.password);
  const user = await User.create({
    name: req.body.name,
    email,
    phone: req.body.phone,
    role,
    passwordHash,
    assignedProjects: req.body.assignedProjects ?? [],
    companyId: req.user!.companyId,
  });
  void sendCreated;
  res.status(201).json({
    success: true,
    message: `${user.name} was added to your team. Share the password with them securely.`,
    data: { ...user.toJSON(), permissions: permissionsForRole(role) },
  });
}

export async function updateTeamMember(req: Request, res: Response) {
  const { id } = req.params;
  const target = await User.findById(id);
  if (!target || !target.companyId?.equals(req.user!.companyId!)) {
    throw ApiError.notFound('Team member not found.');
  }
  if (String(target._id) === String(req.user!._id)) {
    // Owners can still edit themselves via profile endpoints; block demoting self.
    if (req.body.role && normalizeRole(req.body.role) !== 'owner') {
      throw ApiError.badRequest('You cannot change your own role here.');
    }
    delete req.body.isActive;
  }
  if (req.body.role) {
    const role = normalizeRole(String(req.body.role));
    if (['super_admin', 'owner'].includes(role)) {
      throw ApiError.forbidden('This role cannot be assigned from team management.');
    }
    req.body.role = role;
  }

  if (req.body.password) {
    req.body.passwordHash = await User.hashPassword(req.body.password);
    delete req.body.password;
  }

  const updated = await User.findByIdAndUpdate(id, req.body, { new: true }).populate(
    'assignedProjects',
    'name status',
  );
  sendSuccess(res, updated, 'Team member updated successfully.');
}
