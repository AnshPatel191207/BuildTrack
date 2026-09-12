import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import * as analytics from '../controllers/analytics.controller';
import { REPORT_TYPES, generateReport } from '../controllers/erpReport.controller';
import { listAuditLogs } from '../controllers/audit.controller';

const router = Router();
router.use(protect);

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates');

// Module 20 — financial analytics
router.get(
  '/financial',
  requirePermission('canViewFinancials'),
  validate({
    query: z.object({
      projectId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
      from: dateParam.optional(),
      to: dateParam.optional(),
    }),
  }),
  asyncHandler(analytics.financialAnalytics),
);

// Module 21 — executive dashboard
router.get('/executive', asyncHandler(analytics.executiveDashboard));

// Module 22 — reporting system
router.get(
  '/reports',
  requirePermission('canManageReports', 'canViewFinancials'),
  validate({
    query: z.object({
      type: z.enum(REPORT_TYPES),
      projectId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
      from: dateParam.optional(),
      to: dateParam.optional(),
      allTime: z.enum(['true', 'false']).optional(),
    }),
  }),
  asyncHandler(generateReport),
);

// Module 24 — audit logs (mounted under /api/audit)
export const auditRouter = (() => {
  const r = Router();
  r.use(protect);
  r.get(
    '/',
    validate({
      query: z.object({
        module: z.string().trim().max(40).optional(),
        action: z.string().trim().max(40).optional(),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
    }),
    asyncHandler(listAuditLogs),
  );
  return r;
})();

export default router;
