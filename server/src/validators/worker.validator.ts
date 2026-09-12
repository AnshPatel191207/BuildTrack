import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');
const phone = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
  .optional()
  .or(z.literal(''));

export const workerBodySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  phone,
  workerType: z
    .enum(['mason', 'helper', 'electrician', 'plumber', 'carpenter', 'painter', 'welder', 'operator', 'other'])
    .default('helper'),
  dailyWage: z.coerce.number().min(0, 'Daily wage cannot be negative').max(1_000_000),
  skill: z.string().trim().max(120).optional(),
  projectId: objectId.nullable().optional(),
  joiningDate: isoDate.optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  contactId: z.string().trim().max(120).nullable().optional(),
});

export const workerUpdateSchema = workerBodySchema.partial();

export const workerQuerySchema = z.object({
  projectId: objectId.optional(),
  workerType: z
    .enum(['mason', 'helper', 'electrician', 'plumber', 'carpenter', 'painter', 'welder', 'operator', 'other'])
    .optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
