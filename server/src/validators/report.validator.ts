import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');

export const reportBodySchema = z.object({
  projectId: objectId,
  date: isoDate,
  weather: z.enum(['sunny', 'cloudy', 'rainy', 'humid', 'windy', 'other']).default('sunny'),
  summary: z.string().trim().max(2000).optional(),
  workCompleted: z
    .string()
    .trim()
    .min(3, "Describe what work was completed today")
    .max(2000),
  workersPresent: z.coerce.number().int().min(0).max(10000).default(0),
  materialsUsed: z.string().trim().max(1000).optional(),
  issues: z.string().trim().max(1000).optional(),
  safetyNotes: z.string().trim().max(1000).optional(),
  tomorrowPlan: z.string().trim().max(1000).optional(),
  photos: z.array(z.string()).max(20).optional(),
  videos: z.array(z.string()).max(10).optional(),
});

export const reportUpdateSchema = reportBodySchema.partial().omit({ projectId: true });

export const reportQuerySchema = z.object({
  projectId: objectId.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
