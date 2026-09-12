import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');

const projectBodyObject = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters').max(140),
  clientName: z.string().trim().max(120).optional(),
  clientPhone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
    .optional()
    .or(z.literal('')),
  location: z.string().trim().max(160).optional(),
  address: z.string().trim().max(300).optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  siteRadiusMeters: z.coerce.number().min(20, 'Radius must be at least 20m').max(2000).optional(),
  projectType: z
    .enum(['residential', 'commercial', 'industrial', 'renovation', 'infrastructure', 'interior', 'other'])
    .default('residential'),
  startDate: isoDate,
  expectedEndDate: isoDate.optional(),
  budget: z.coerce.number().min(0, 'Budget cannot be negative').max(1e12),
  description: z.string().trim().max(1000).optional(),
  progressPercentage: z.coerce.number().min(0).max(100).optional(),
  projectManagerId: objectId.optional().nullable(),
});

export const projectBodySchema = projectBodyObject.refine(
  (data) =>
    !data.expectedEndDate ||
    !data.startDate ||
    new Date(data.expectedEndDate) >= new Date(data.startDate),
  { message: 'Expected end date must be after the start date', path: ['expectedEndDate'] },
);

export const projectUpdateSchema = projectBodyObject.partial().extend({
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
});

export const projectQuerySchema = z.object({
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
