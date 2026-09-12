import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');

const materialBody = {
  projectId: objectId,
  name: z.string().trim().min(2, 'Material name must be at least 2 characters').max(140),
  category: z.enum([
    'cement', 'steel', 'sand', 'aggregate', 'bricks', 'tiles',
    'plumbing', 'electrical', 'paint', 'hardware', 'other',
  ]),
  unit: z
    .enum(['bag','kg','quintal','ton','brass','cft','sqft','litre','meter','roll','piece','packet','box','trip','other'])
    .default('piece'),
  currentStock: z.coerce.number().min(0, 'Stock cannot be negative').default(0),
  minimumStock: z.coerce.number().min(0, 'Minimum stock cannot be negative').default(0),
  averagePrice: z.coerce.number().min(0, 'Average price cannot be negative').default(0),
  supplier: z.string().trim().max(160).optional(),
};

export const materialBodySchema = z.object(materialBody);

export const materialUpdateSchema = z
  .object({
    name: materialBody.name.optional(),
    category: materialBody.category,
    unit: materialBody.unit,
    minimumStock: z.coerce.number().min(0).optional(),
    averagePrice: z.coerce.number().min(0).optional(),
    supplier: z.string().trim().max(160).nullable().optional(),
  })
  .partial();

export const transactionBodySchema = z
  .object({
    type: z.enum(['purchase', 'usage', 'adjustment', 'return']),
    quantity: z.coerce.number().refine((q) => q !== 0, 'Quantity cannot be zero'),
    unitPrice: z.coerce.number().min(0).optional(),
    supplier: z.string().trim().max(160).optional(),
    invoiceNumber: z.string().trim().max(80).optional(),
    date: isoDate.optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .refine(
    (t) => t.type === 'adjustment' || t.quantity > 0,
    { message: 'Quantity must be greater than 0', path: ['quantity'] },
  );

export const materialQuerySchema = z.object({
  projectId: objectId.optional(),
  search: z.string().trim().max(120).optional(),
  lowStock: z.enum(['true', 'false']).optional(),
});
