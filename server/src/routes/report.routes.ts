import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { reportBodySchema, reportQuerySchema } from '../validators/report.validator';
import * as reports from '../controllers/report.controller';

const router = Router();

router.use(protect);

router.get('/', authorize('owner', 'manager', 'engineer'), validate({ query: reportQuerySchema }), asyncHandler(reports.listReports));
router.post('/', authorize('owner', 'manager', 'engineer'), validate({ body: reportBodySchema }), asyncHandler(reports.createReport));
router.get('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(reports.getReport));
router.put('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(reports.updateReport));
router.delete('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(reports.deleteReport));

export default router;
