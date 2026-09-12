import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  expenseBodySchema,
  expenseQuerySchema,
  expenseAnalyticsQuerySchema,
} from '../validators/expense.validator';
import * as expenses from '../controllers/expense.controller';

const router = Router();

router.use(protect);

router.get(
  '/analytics',
  authorize('owner', 'manager', 'engineer'),
  validate({ query: expenseAnalyticsQuerySchema }),
  asyncHandler(expenses.expenseAnalytics),
);
router.get(
  '/',
  authorize('owner', 'manager', 'engineer'),
  validate({ query: expenseQuerySchema }),
  asyncHandler(expenses.listExpenses),
);
router.post(
  '/',
  authorize('owner', 'manager', 'engineer'),
  validate({ body: expenseBodySchema }),
  asyncHandler(expenses.createExpense),
);
router.get('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(expenses.getExpense));
router.put('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(expenses.updateExpense));
router.delete('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(expenses.deleteExpense));

export default router;
