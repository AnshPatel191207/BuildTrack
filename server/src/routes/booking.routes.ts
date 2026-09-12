import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  bookingBodySchema,
  bookingActionSchema,
  bookingScheduleSchema,
  bookingQuerySchema,
} from '../validators/erp.validator';
import * as bookings from '../controllers/booking.controller';

const router = Router();
router.use(protect);

router.get('/', validate({ query: bookingQuerySchema }), asyncHandler(bookings.listBookings));
router.post(
  '/',
  requirePermission('canManageBookings'),
  validate({ body: bookingBodySchema }),
  asyncHandler(bookings.createBooking),
);
router.get('/:id', asyncHandler(bookings.getBooking));
router.post(
  '/:id/actions',
  requirePermission('canManageBookings'),
  validate({ body: bookingActionSchema }),
  asyncHandler(bookings.bookingAction),
);
router.post(
  '/:id/schedule',
  requirePermission('canManagePayments'),
  validate({ body: bookingScheduleSchema }),
  asyncHandler(bookings.generateSchedule),
);
router.delete(
  '/:id',
  requirePermission('canManageBookings'),
  asyncHandler(bookings.deleteBooking),
);

export default router;
