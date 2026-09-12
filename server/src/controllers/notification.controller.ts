import { sendSuccess } from '../utils/apiResponse';
import { Notification } from '../models/Notification';
import { ApiError } from '../utils/apiResponse';
import type { Request, Response } from 'express';

export async function listNotifications(req: Request & { validatedQuery?: any }, res: Response) {
  const page = req.validatedQuery?.page ?? 1;
  const limit = Math.min(req.validatedQuery?.limit ?? 20, 50);
  const filter = { userId: (req.user as any)._id };

  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('relatedProjectId', 'name'),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);

  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    extra: { unread },
  });
}

export async function unreadCount(req: Request, res: Response) {
  const count = await Notification.countDocuments({
    userId: (req.user as any)._id,
    isRead: false,
  });
  sendSuccess(res, { count });
}

export async function markNotificationRead(req: Request, res: Response) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: (req.user as any)._id },
    { $set: { isRead: true } },
    { new: true },
  );
  if (!notification) throw ApiError.notFound('Notification not found.');
  sendSuccess(res, notification, 'Marked as read.');
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  await Notification.updateMany(
    { userId: (req.user as any)._id, isRead: false },
    { $set: { isRead: true } },
  );
  sendSuccess(res, null, 'All notifications marked as read.');
}
