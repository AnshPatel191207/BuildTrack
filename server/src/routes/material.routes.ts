import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { materialBodySchema, materialUpdateSchema, transactionBodySchema, materialQuerySchema } from '../validators/material.validator';
import * as materials from '../controllers/material.controller';

const router = Router();

router.use(protect);
router.use(authorize('owner', 'manager', 'engineer'));

router.get('/', validate({ query: materialQuerySchema }), asyncHandler(materials.listMaterials));
router.post('/', validate({ body: materialBodySchema }), asyncHandler(materials.createMaterial));
router.get('/:id', asyncHandler(materials.getMaterial));
router.put('/:id', validate({ body: materialUpdateSchema }), asyncHandler(materials.updateMaterial));
router.delete('/:id', asyncHandler(materials.deleteMaterial));
router.post('/:id/transactions', validate({ body: transactionBodySchema }), asyncHandler(materials.createMaterialTransaction));

export default router;
