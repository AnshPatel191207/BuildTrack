import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  poBodySchema,
  poUpdateSchema,
  poTransitionSchema,
  poPaymentSchema,
  poQuerySchema,
} from '../validators/erp.validator';
import * as pos from '../controllers/purchaseOrder.controller';

const router = Router();
router.use(protect);

router.get('/', validate({ query: poQuerySchema }), asyncHandler(pos.listPurchaseOrders));
router.post(
  '/',
  requirePermission('canManagePurchaseOrders'),
  validate({ body: poBodySchema }),
  asyncHandler(pos.createPurchaseOrder),
);
router.get('/:id', asyncHandler(pos.getPurchaseOrder));
router.put(
  '/:id',
  requirePermission('canManagePurchaseOrders'),
  validate({ body: poUpdateSchema }),
  asyncHandler(pos.updatePurchaseOrder),
);
router.post(
  '/:id/transition',
  requirePermission('canManagePurchaseOrders'),
  validate({ body: poTransitionSchema }),
  asyncHandler(pos.transitionPurchaseOrder),
);
router.post(
  '/:id/payments',
  requirePermission('canManagePayments'),
  validate({ body: poPaymentSchema }),
  asyncHandler(pos.recordPoPayment),
);

export default router;
