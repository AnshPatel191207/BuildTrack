import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  approvalActionSchema,
  approvalCreateSchema,
  approvalQuerySchema,
} from '../validators/erp.validator';
import * as approvals from '../controllers/approval.controller';

const router = Router();
router.use(protect);

router.get('/', validate({ query: approvalQuerySchema }), asyncHandler(approvals.listApprovals));
router.post(
  '/',
  requirePermission('canManageExpenses'),
  validate({ body: approvalCreateSchema }),
  asyncHandler(approvals.createApproval),
);
router.post(
  '/:id/act',
  validate({ body: approvalActionSchema }),
  asyncHandler(approvals.actOnApproval),
);

export default router;
