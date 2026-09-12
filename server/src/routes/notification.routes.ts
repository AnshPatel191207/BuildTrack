import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect } from '../middleware/auth';
import * as notifications from '../controllers/notification.controller';

const router = Router();

router.use(protect);

router.get('/', asyncHandler(notifications.listNotifications));
router.get('/unread-count', asyncHandler(notifications.unreadCount));
router.put('/read-all', asyncHandler(notifications.markAllNotificationsRead));
router.put('/:id/read', asyncHandler(notifications.markNotificationRead));

export default router;
