import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  structureNodeBodySchema,
  structureNodeUpdateSchema,
  structureQuerySchema,
  structureNodeQuerySchema,
  unitBodySchema,
  unitUpdateSchema,
  unitQuerySchema,
} from '../validators/erp.validator';
import * as structure from '../controllers/structure.controller';
import * as units from '../controllers/unit.controller';

const router = Router();
router.use(protect);

// ── Project structure (Module 2) ─────────────────────────────────
router.get('/structure', validate({ query: structureNodeQuerySchema }), asyncHandler(structure.listNodes));
router.get('/structure/tree', validate({ query: structureQuerySchema }), asyncHandler(structure.getTree));
router.post(
  '/structure',
  requirePermission('canManageStructure'),
  validate({ body: structureNodeBodySchema }),
  asyncHandler(structure.createNode),
);
router.put(
  '/structure/:id',
  requirePermission('canManageStructure'),
  validate({ body: structureNodeUpdateSchema }),
  asyncHandler(structure.updateNode),
);
router.delete(
  '/structure/:id',
  requirePermission('canManageStructure'),
  asyncHandler(structure.deleteNode),
);

// ── Unit inventory (Module 3) ────────────────────────────────────
router.get('/inventory-summary', validate({ query: unitQuerySchema }), asyncHandler(units.getInventorySummary));
router.get('/', validate({ query: unitQuerySchema }), asyncHandler(units.listUnits));
router.post(
  '/',
  requirePermission('canManageUnits'),
  validate({ body: unitBodySchema }),
  asyncHandler(units.createUnit),
);
router.get('/:id', asyncHandler(units.getUnit));
router.put(
  '/:id',
  requirePermission('canManageUnits'),
  validate({ body: unitUpdateSchema }),
  asyncHandler(units.updateUnit),
);
router.delete('/:id', requirePermission('canManageUnits'), asyncHandler(units.deleteUnit));

export default router;
