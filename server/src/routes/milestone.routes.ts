import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  milestoneBodySchema,
  milestoneUpdateSchema,
  milestoneQuerySchema,
} from '../validators/erp.validator';
import * as milestones from '../controllers/milestone.controller';

const router = Router();
router.use(protect);

router.get('/', validate({ query: milestoneQuerySchema }), asyncHandler(milestones.listMilestones));
router.post(
  '/',
  requirePermission('canManageProgress'),
  validate({ body: milestoneBodySchema }),
  asyncHandler(milestones.createMilestone),
);
router.put(
  '/:id',
  requirePermission('canManageProgress'),
  validate({ body: milestoneUpdateSchema }),
  asyncHandler(milestones.updateMilestone),
);
router.delete(
  '/:id',
  requirePermission('canManageProgress'),
  asyncHandler(milestones.deleteMilestone),
);

export default router;
