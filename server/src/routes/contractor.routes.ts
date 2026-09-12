import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  contractorBodySchema,
  contractorUpdateSchema,
  contractorQuerySchema,
  contractBodySchema,
  contractUpdateSchema,
  contractPaymentBodySchema,
} from '../validators/erp.validator';
import * as contractors from '../controllers/contractor.controller';

const router = Router();
router.use(protect);

router.get('/outstanding', asyncHandler(contractors.contractorOutstanding));
router.get('/', validate({ query: contractorQuerySchema }), asyncHandler(contractors.listContractors));
router.post(
  '/',
  requirePermission('canManageContractors'),
  validate({ body: contractorBodySchema }),
  asyncHandler(contractors.createContractor),
);
router.get('/:id', asyncHandler(contractors.getContractor));
router.put(
  '/:id',
  requirePermission('canManageContractors'),
  validate({ body: contractorUpdateSchema }),
  asyncHandler(contractors.updateContractor),
);
router.delete(
  '/:id',
  requirePermission('canManageContractors'),
  asyncHandler(contractors.deleteContractor),
);

// Contracts live under a contractor.
router.post(
  '/:id/contracts',
  requirePermission('canManageContractors'),
  validate({ body: contractBodySchema }),
  asyncHandler(contractors.createContract),
);
router.put(
  '/:id/contracts/:contractId',
  requirePermission('canManageContractors'),
  validate({ body: contractUpdateSchema }),
  asyncHandler(contractors.updateContract),
);
router.delete(
  '/:id/contracts/:contractId',
  requirePermission('canManageContractors'),
  asyncHandler(contractors.deleteContract),
);
router.post(
  '/:id/contracts/:contractId/payments',
  requirePermission('canManageContractors'),
  validate({ body: contractPaymentBodySchema }),
  asyncHandler(contractors.recordContractPayment),
);

export default router;
