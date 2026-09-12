import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');
const phone = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
  .or(z.literal(''));

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(120),
  phone,
  email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')),
  address: z.string().trim().max(300).optional(),
});

export const ALL_ROLES = [
  'super_admin',
  'owner',
  'project_manager',
  'site_engineer',
  'accountant',
  'sales_manager',
  'supervisor',
  'manager',
  'engineer',
  'worker',
] as const;

/** Roles an owner can assign to teammates. */
const ASSIGNABLE_ROLES = [
  'project_manager',
  'site_engineer',
  'accountant',
  'sales_manager',
  'supervisor',
  'manager',
  'engineer',
  'worker',
] as const;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone,
  role: z.enum(ASSIGNABLE_ROLES),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  assignedProjects: z.array(objectId).default([]),
});

export const updateUserSchema = z
  .object({
    role: z.enum(ASSIGNABLE_ROLES).optional(),
    isActive: z.boolean().optional(),
    assignedProjects: z.array(objectId).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(72).optional(),
    phone,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No changes provided' });
