import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');

export const expenseBodySchema = z.object({
  projectId: objectId,
  category: z.enum([
    'materials',
    'labor',
    'transportation',
    'equipment',
    'electricity',
    'permits',
    'food',
    'maintenance',
    'miscellaneous',
  ]),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  amount: z.coerce.number().positive('Amount must be greater than 0').max(1_000_000_000),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']).default('cash'),
  date: isoDate,
  description: z.string().trim().max(500).optional(),
  receiptImage: z
    .object({
      url: z.string().min(1),
      publicId: z.string().nullable().optional(),
    })
    .optional(),
});

export const expenseQuerySchema = z.object({
  projectId: objectId.optional(),
  category: z
    .enum([
      'materials',
      'labor',
      'transportation',
      'equipment',
      'electricity',
      'permits',
      'food',
      'maintenance',
      'miscellaneous',
    ])
    .optional(),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const expenseAnalyticsQuerySchema = z.object({
  projectId: objectId.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format').optional(),
});
