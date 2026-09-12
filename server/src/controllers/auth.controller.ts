import { Request, Response, NextFunction } from 'express';
import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { User } from '../models/User';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
} from '../validators/auth.validator';
import * as authService from '../services/auth.service';
import { protect } from '../middleware/auth';

interface AuthedRequest extends Request {}

export async function register(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body ?? {});
    const result = await authService.registerUser(data);
    sendCreated(res, result, `Welcome to BuildTrack, ${result.user.name}!`);
  } catch (err) {
    next(err);
  }
}

export async function login(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body ?? {});
    const result = await authService.loginUser(email, password);
    sendSuccess(res, result, `Welcome back, ${result.user.name.split(' ')[0]}!`);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body ?? {});
    const result = await authService.refreshSession(refreshToken);
    sendSuccess(res, result, 'Token refreshed.');
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const refreshToken = (req.body as any)?.refreshToken as string | undefined;
    await authService.logoutUser(refreshToken);
    sendSuccess(res, null, 'Signed out successfully.');
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const user = await authService.getCurrentUser(String(req.user._id));
    void User;
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body ?? {});
    await authService.changePassword(String(req.user!._id), currentPassword, newPassword);
    sendSuccess(res, null, 'Password changed successfully. Please sign in again on other devices.');
  } catch (err) {
    next(err);
  }
}

/** Update own lightweight profile fields. */
export async function updateProfile(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const allowed = ['name', 'phone'] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (typeof req.body?.[key] === 'string' && req.body[key]) updates[key] = req.body[key];
    }
    if (!updates.name && !updates.phone) {
      throw ApiError.badRequest('Nothing to update.');
    }
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    sendSuccess(res, user, 'Profile updated successfully.');
  } catch (err) {
    next(err);
  }
}

void protect;
