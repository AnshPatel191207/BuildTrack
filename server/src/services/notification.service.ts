import { Notification } from '../models/Notification';
import type { NotificationType } from '../types';
import { logError } from '../utils/logger';

interface CreateInput {
  userId: unknown;
  title: string;
  message: string;
  type: NotificationType;
  relatedProjectId?: unknown | null;
}

/**
 * Notifications should never break the main request flow — failures are logged
 * and swallowed. Recipients are deduped so a single event doesn't spam the
 * same user twice.
 */
export async function notifyUsers(inputs: CreateInput[]): Promise<void> {
  const seen = new Set<string>();
  const docs = inputs.filter((i) => {
    if (!i.userId) return false;
    const key = `${String(i.userId)}:${i.type}:${i.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (docs.length === 0) return;
  try {
    await Notification.insertMany(docs);
  } catch (err) {
    logError('Failed to create notifications', err);
  }
}

export async function notifyProjectStakeholders(opts: {
  ownerId: unknown;
  managerId?: unknown | null;
  projectId?: unknown | null;
  title: string;
  message: string;
  type: NotificationType;
}): Promise<void> {
  const targets = [opts.ownerId, opts.managerId].filter(Boolean);
  await notifyUsers(
    targets.map((userId) => ({
      userId,
      projectId: opts.projectId ?? null,
      title: opts.title,
      message: opts.message,
      type: opts.type,
    })),
  );
}
