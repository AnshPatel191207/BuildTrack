import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Types } from 'mongoose';
import { env } from '../config/env';
import type { UserRole } from '../types';
import { ApiError } from './apiResponse';

export interface TokenPayload {
  sub: string;
  role: UserRole;
  companyId?: string | null;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
}

const REFRESH_TTL_DAYS = env.JWT_REFRESH_EXPIRES_DAYS;

export function generateRefreshToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function idToString(id: Types.ObjectId | string | null | undefined): string | null {
  if (!id) return null;
  return typeof id === 'string' ? id : String(id);
}
