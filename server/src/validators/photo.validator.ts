import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const photoUploadSchema = z.object({
  projectId: objectId,
  category: z.enum(['progress', 'material', 'issue', 'safety', 'completion']).default('progress'),
  description: z.string().trim().max(300).optional(),
  durationSeconds: z.coerce.number().min(0).max(3600).optional(),
});

export const photoQuerySchema = z.object({
  projectId: objectId.optional(),
  category: z.enum(['progress', 'material', 'issue', 'safety', 'completion']).optional(),
  kind: z.enum(['image', 'video', 'document']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
