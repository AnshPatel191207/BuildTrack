import { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../utils/token';
import { ApiError } from '../utils/apiResponse';
import { User } from '../models/User';
import { hasAnyPermission } from '../utils/permissions';
import { normalizeRole, type AuthUser, type Permission } from '../types';

/** Require a valid Bearer access token and an active user. */
export const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Please sign in to continue.');
    }
    const payload = verifyAccessToken(header.slice(7).trim());
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Your account is no longer active.');
    }
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role as string) as AuthUser['role'],
      companyId: user.companyId ?? null,
      assignedProjects: user.assignedProjects ?? [],
      isActive: user.isActive,
    };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role authorisation. Pass the minimum allowed roles; higher roles inherit.
 * Legacy aliases ('manager', 'engineer') are normalised, so canonical roles
 * satisfy legacy checks automatically.
 */
const ROLE_EQUIVALENTS: Record<string, string[]> = {
  owner: ['owner'],
  manager: ['manager', 'project_manager'],
  engineer: ['engineer', 'site_engineer'],
  project_manager: ['project_manager', 'manager'],
  site_engineer: ['site_engineer', 'engineer'],
};

export const authorize =
  (...roles: string[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const allowed = new Set<string>();
    for (const role of roles) {
      for (const equivalent of ROLE_EQUIVALENTS[role] ?? [role]) {
        allowed.add(equivalent);
      }
    }
    if (!allowed.has(req.user.role)) {
      return next(ApiError.forbidden('Your role does not allow this action.'));
    }
    // Managers can act on behalf of owners for company-scoped reads where needed.
    void res;
    next();
  };

/**
 * Dynamic permission authorisation. Enforced at the API level so hiding UI
 * elements on the client can never be the only barrier.
 */
export const requirePermission =
  (...permissions: Permission[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!hasAnyPermission(req.user.role as string, permissions)) {
      return next(
        ApiError.forbidden(
          `Your ${String(req.user.role).replace('_', ' ')} role does not allow this action.`,
        ),
      );
    }
    next();
  };
