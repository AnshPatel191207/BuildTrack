import { ApiError } from '../utils/apiResponse';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { RefreshToken } from '../models/RefreshToken';
import { permissionsForRole } from '../utils/permissions';
import { normalizeRole } from '../types';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../utils/token';

interface AuthResult {
  user: any;
  accessToken: string;
  refreshToken: string;
}

/** Attach the effective permission set so clients can gate the UI. */
function withPermissions(user: any): any {
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : user;
  return { ...plain, role: normalizeRole(String(plain.role)), permissions: permissionsForRole(String(plain.role)) };
}

function toAuthPayload(userId: string, role: string, companyId?: unknown) {
  return signAccessToken({
    sub: String(userId),
    role: role as any,
    companyId: companyId ? String(companyId) : null,
  });
}

async function issueTokens(user: { _id: unknown; role: string; companyId?: unknown }): Promise<string> {
  const { token, expiresAt } = generateRefreshToken();
  await RefreshToken.create({
    userId: user._id as any,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return token;
}

export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthResult> {
  const exists = await User.findOne({ email: input.email });
  if (exists) {
    throw ApiError.conflict('An account with this email already exists. Try signing in instead.');
  }
  const passwordHash = await User.hashPassword(input.password);
  // New registrations become company owners and complete onboarding next.
  const user = await User.create({ ...input, passwordHash, role: 'owner' });
  const refreshToken = await issueTokens(user);
  return {
    user: withPermissions(user),
    accessToken: toAuthPayload(user._id, user.role, user.companyId),
    refreshToken,
  };
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password.');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Contact your company owner.');
  }
  const refreshToken = await issueTokens(user);
  return {
    user: withPermissions(user),
    accessToken: toAuthPayload(user._id, user.role, user.companyId),
    refreshToken,
  };
}

/** Rotate the refresh token and return a fresh pair. */
export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  const tokenHash = hashToken(refreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  const user = await User.findById(stored.userId).select('+passwordHash');
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Your account is no longer active.');
  }

  stored.revoked = true;
  await stored.save();

  const newRefreshToken = await issueTokens(user);
  return {
    user: withPermissions(user),
    accessToken: toAuthPayload(user._id, user.role, user.companyId),
    refreshToken: newRefreshToken,
  };
}

export async function logoutUser(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(refreshToken) },
    { $set: { revoked: true } },
  );
}

export async function getCurrentUser(userId: string): Promise<any> {
  const user = await User.findById(userId)
    .populate('companyId', 'name logo phone email address')
    .populate('assignedProjects', 'name status location');
  if (!user) throw ApiError.notFound('Account not found.');
  return withPermissions(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('Account not found.');
  if (!(await user.verifyPassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect.');
  }
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
  // Invalidate all other sessions.
  await RefreshToken.updateMany({ userId: user._id, revoked: false }, { revoked: true });
}
