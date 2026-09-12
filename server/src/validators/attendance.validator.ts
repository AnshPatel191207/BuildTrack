import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const isoDate = z
  .string()
  .refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format')
  .optional()
  .or(z.literal('').transform(() => null));

export const attendanceGeoSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  distanceMeters: z.coerce.number().min(0).max(100000).optional(),
});

export const attendanceEntrySchema = z.object({
  workerId: objectId,
  status: z.enum(['present', 'absent', 'half_day', 'leave']),
  checkIn: timeString,
  checkOut: timeString,
  overtimeHours: z.coerce.number().min(0).max(12).default(0).optional(),
  remarks: z.string().trim().max(300).optional(),
  geo: attendanceGeoSchema.optional(),
});

export const attendanceSingleSchema = attendanceEntrySchema.extend({
  projectId: objectId,
  date: isoDate,
});

export const attendanceBulkSchema = z.object({
  projectId: objectId,
  date: isoDate,
  entries: z.array(attendanceEntrySchema).min(1, 'Provide at least one worker entry').max(500),
});

export const attendanceQuerySchema = z.object({
  projectId: objectId.optional(),
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  workerId: objectId.optional(),
});
