import { AuditLog } from '../models/AuditLog';
import { logError } from './logger';
import type { AuthUser } from '../types';
import type { Request } from 'express';

/**
 * Fire-and-forget audit trail. Failures never break the main request flow.
 */
export async function logAudit(
  req: Request,
  input: {
    action: string;
    module: string;
    description: string;
    entityType?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const user = req.user as AuthUser | undefined;
    await AuditLog.create({
      companyId: user?.companyId ?? null,
      userId: user?._id ?? null,
      userName: user?.name,
      userRole: user?.role,
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId ? String(input.entityId) : undefined,
      description: input.description.slice(0, 500),
      meta: input.meta ?? null,
      ip: req.ip,
    });
  } catch (err) {
    logError('Failed to write audit log', err);
  }
}
