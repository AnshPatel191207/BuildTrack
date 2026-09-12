import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  customerBodySchema,
  customerUpdateSchema,
  customerQuerySchema,
  customerTimelineSchema,
} from '../validators/erp.validator';
import * as customers from '../controllers/customer.controller';

const router = Router();
router.use(protect);

router.get('/', validate({ query: customerQuerySchema }), asyncHandler(customers.listCustomers));
router.post(
  '/',
  requirePermission('canManageCustomers'),
  validate({ body: customerBodySchema }),
  asyncHandler(customers.createCustomer),
);
router.get('/:id', asyncHandler(customers.getCustomer));
router.put(
  '/:id',
  requirePermission('canManageCustomers'),
  validate({ body: customerUpdateSchema }),
  asyncHandler(customers.updateCustomer),
);
router.delete(
  '/:id',
  requirePermission('canManageCustomers'),
  asyncHandler(customers.deleteCustomer),
);
router.post(
  '/:id/timeline',
  requirePermission('canManageCustomers'),
  validate({ body: customerTimelineSchema }),
  asyncHandler(customers.addTimelineEvent),
);

export default router;
