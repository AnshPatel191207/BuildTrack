import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  stageUpdateSchema,
  stageQuerySchema,
  workItemBodySchema,
  workItemUpdateSchema,
  workItemQuerySchema,
} from '../validators/erp.validator';
import * as progress from '../controllers/progress.controller';

const router = Router();
router.use(protect);

// Construction stages (Module 10)
router.get('/stages', validate({ query: stageQuerySchema }), asyncHandler(progress.listStages));
router.put(
  '/stages/:id',
  requirePermission('canManageProgress'),
  validate({ body: stageUpdateSchema }),
  asyncHandler(progress.updateStage),
);

// Work items (Module 9)
router.get('/work-items', validate({ query: workItemQuerySchema }), asyncHandler(progress.listWorkItems));
router.post(
  '/work-items',
  requirePermission('canManageProgress'),
  validate({ body: workItemBodySchema }),
  asyncHandler(progress.createWorkItem),
);
router.put(
  '/work-items/:id',
  requirePermission('canManageProgress'),
  validate({ body: workItemUpdateSchema }),
  asyncHandler(progress.updateWorkItem),
);
router.delete(
  '/work-items/:id',
  requirePermission('canManageProgress'),
  asyncHandler(progress.deleteWorkItem),
);

export default router;
