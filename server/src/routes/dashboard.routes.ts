import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { getGlobalDashboard } from '../controllers/dashboard.controller';

const router = Router();

const dashboardQuerySchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id').optional(),
});

router.use(protect);
router.use(authorize('owner', 'manager', 'engineer'));

router.get('/', validate({ query: dashboardQuerySchema }), asyncHandler(getGlobalDashboard as any));

export default router;
