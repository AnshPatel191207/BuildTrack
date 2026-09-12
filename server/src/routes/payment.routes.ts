import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  paymentBodySchema,
  paymentUpdateSchema,
  markPaidSchema,
  paymentQuerySchema,
} from '../validators/erp.validator';
import * as payments from '../controllers/payment.controller';

const router = Router();
router.use(protect);

router.get('/receivables', requirePermission('canViewReceivables'), validate({ query: paymentQuerySchema }), asyncHandler(payments.receivablesDashboard));
router.get('/', requirePermission('canViewReceivables'), validate({ query: paymentQuerySchema }), asyncHandler(payments.listPayments));
router.post(
  '/',
  requirePermission('canManagePayments'),
  validate({ body: paymentBodySchema }),
  asyncHandler(payments.createPayment),
);
router.get('/:id', asyncHandler(payments.getPayment));
router.put(
  '/:id',
  requirePermission('canManagePayments'),
  validate({ body: paymentUpdateSchema }),
  asyncHandler(payments.updatePayment),
);
router.post(
  '/:id/mark-paid',
  requirePermission('canManagePayments'),
  validate({ body: markPaidSchema }),
  asyncHandler(payments.markPaymentPaid),
);
router.delete(
  '/:id',
  requirePermission('canManagePayments'),
  asyncHandler(payments.deletePayment),
);

export default router;
