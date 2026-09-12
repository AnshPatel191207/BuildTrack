import { Types } from 'mongoose';

/**
 * Date helpers. All dates are normalised to UTC midnight so that
 * "a site day" is stable regardless of server timezone.
 * Clients send YYYY-MM-DD strings; we store Date objects at UTC midnight.
 */

/** Normalise a date-ish value to UTC midnight of that calendar date. */
export function utcDay(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return utcDay(d);
}

export function todayUtc(): Date {
  return utcDay(new Date());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function startOfMonthUtc(ref: Date | string = todayUtc()): Date {
  const d = utcDay(ref);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfDayUtc(date: Date): Date {
  return addDays(date, 1);
}

/** Format a Date back into YYYY-MM-DD (UTC based). */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDateString(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Escape user text before embedding it in a RegExp. */
export function escapeRegex(text: string): string {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cast a string id to ObjectId for use inside aggregation $match stages
 * (unlike find(), aggregate does not auto-cast by schema).
 */
export function toObjectId(id: unknown): Types.ObjectId {
  return id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id));
}
