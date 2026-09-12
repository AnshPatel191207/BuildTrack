import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  equipmentBodySchema,
  equipmentUpdateSchema,
  equipmentLogSchema,
  equipmentQuerySchema,
} from '../validators/erp.validator';
import * as equipment from '../controllers/equipment.controller';

const router = Router();
router.use(protect);

router.get('/', validate({ query: equipmentQuerySchema }), asyncHandler(equipment.listEquipment));
router.post(
  '/',
  requirePermission('canManageEquipment'),
  validate({ body: equipmentBodySchema }),
  asyncHandler(equipment.createEquipment),
);
router.get('/:id', asyncHandler(equipment.getEquipment));
router.put(
  '/:id',
  requirePermission('canManageEquipment'),
  validate({ body: equipmentUpdateSchema }),
  asyncHandler(equipment.updateEquipment),
);
router.delete(
  '/:id',
  requirePermission('canManageEquipment'),
  asyncHandler(equipment.deleteEquipment),
);
router.post(
  '/:id/logs',
  requirePermission('canManageEquipment'),
  validate({ body: equipmentLogSchema }),
  asyncHandler(equipment.addUsageLog),
);

export default router;
