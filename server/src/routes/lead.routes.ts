import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  leadBodySchema,
  leadUpdateSchema,
  leadFollowUpSchema,
  leadNoteSchema,
  leadConvertSchema,
  leadQuerySchema,
} from '../validators/erp.validator';
import * as leads from '../controllers/lead.controller';

const router = Router();
router.use(protect);

router.get('/sales-dashboard', validate({ query: leadQuerySchema }), asyncHandler(leads.salesDashboard));
router.get('/', validate({ query: leadQuerySchema }), asyncHandler(leads.listLeads));
router.post(
  '/',
  requirePermission('canManageLeads'),
  validate({ body: leadBodySchema }),
  asyncHandler(leads.createLead),
);
router.get('/:id', asyncHandler(leads.getLead));
router.put(
  '/:id',
  requirePermission('canManageLeads'),
  validate({ body: leadUpdateSchema }),
  asyncHandler(leads.updateLead),
);
router.delete(
  '/:id',
  requirePermission('canManageLeads'),
  asyncHandler(leads.deleteLead),
);
router.post(
  '/:id/follow-ups',
  requirePermission('canManageLeads'),
  validate({ body: leadFollowUpSchema }),
  asyncHandler(leads.addFollowUp),
);
router.post(
  '/:id/follow-ups/:index/complete',
  asyncHandler(leads.completeFollowUp),
);
router.post(
  '/:id/notes',
  requirePermission('canManageLeads'),
  validate({ body: leadNoteSchema }),
  asyncHandler(leads.addNote),
);
router.post(
  '/:id/convert',
  requirePermission('canManageLeads'),
  validate({ body: leadConvertSchema }),
  asyncHandler(leads.convertLead),
);

export default router;
