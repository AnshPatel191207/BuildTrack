import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  vendorBodySchema,
  vendorUpdateSchema,
  vendorQuerySchema,
} from '../validators/erp.validator';
import * as vendors from '../controllers/vendor.controller';

const router = Router();
router.use(protect);

router.get('/', validate({ query: vendorQuerySchema }), asyncHandler(vendors.listVendors));
router.post(
  '/',
  requirePermission('canManageVendors'),
  validate({ body: vendorBodySchema }),
  asyncHandler(vendors.createVendor),
);
router.get('/:id', asyncHandler(vendors.getVendor));
router.put(
  '/:id',
  requirePermission('canManageVendors'),
  validate({ body: vendorUpdateSchema }),
  asyncHandler(vendors.updateVendor),
);
router.delete(
  '/:id',
  requirePermission('canManageVendors'),
  asyncHandler(vendors.deleteVendor),
);

export default router;
