import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');

export const taskBodySchema = z.object({
  projectId: objectId,
  title: z.string().trim().min(3, 'Task title must be at least 3 characters').max(160),
  description: z.string().trim().max(1000).optional(),
  assignedTo: objectId.nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'completed', 'blocked']).default('todo'),
  dueDate: isoDate.nullable().optional(),
});

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    assignedTo: objectId.nullable().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: z.enum(['todo', 'in_progress', 'completed', 'blocked']).optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No changes provided' });

export const taskQuerySchema = z.object({
  projectId: objectId.optional(),
  status: z.enum(['todo', 'in_progress', 'completed', 'blocked']).optional(),
});
