import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  attendanceBulkSchema,
  attendanceSingleSchema,
  attendanceQuerySchema,
} from '../validators/attendance.validator';
import * as attendance from '../controllers/attendance.controller';

const router = Router();

router.use(protect);

router.get('/', authorize('owner', 'manager', 'engineer'), validate({ query: attendanceQuerySchema }), asyncHandler(attendance.listAttendance));
router.post('/bulk', authorize('owner', 'manager', 'engineer'), validate({ body: attendanceBulkSchema }), asyncHandler(attendance.bulkMarkAttendance));
router.post('/', authorize('owner', 'manager', 'engineer'), validate({ body: attendanceSingleSchema }), asyncHandler(attendance.markSingleAttendance));
router.put('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(attendance.updateAttendance));

export default router;
