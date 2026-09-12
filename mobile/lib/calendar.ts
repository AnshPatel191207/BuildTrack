export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Monday-first weekday initials. */
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** 0 = Monday … 6 = Sunday. */
export function firstWeekdayOfMonth(year: number, monthIndex0: number): number {
  const jsDay = new Date(Date.UTC(year, monthIndex0, 1)).getUTCDay(); // 0 = Sun
  return (jsDay + 6) % 7;
}

/** Date -> 'YYYY-MM-DD' (local time). */
export function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}
