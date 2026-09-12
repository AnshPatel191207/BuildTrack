/**
 * India-first formatting helpers: INR currency, DD/MM/YYYY dates and
 * compact lakh/crore notation.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

/** ₹1,25,000 */
export function formatINR(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '₹0';
  return inrFormatter.format(Math.round(amount)).replace('₹', '₹');
}

/** 1,25,000 (no symbol) */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0';
  return inrDecimalFormatter.format(value);
}

/** ₹42.5L / ₹1.25Cr / ₹9,500 — compact display for dashboards. */
export function formatCompactINR(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_00_00_000) {
    const v = abs / 1_00_00_000;
    return `${sign}₹${trimZeros(v.toFixed(2))}Cr`;
  }
  if (abs >= 1_00_000) {
    const v = abs / 1_00_000;
    return `${sign}₹${trimZeros(v.toFixed(2))}L`;
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    return `${sign}₹${trimZeros(v.toFixed(1))}K`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

function trimZeros(s: string): string {
  return s.replace(/\.?0+$/, '');
}

// ── Dates ────────────────────────────────────────────────────────

/**
 * Parse a YYYY-MM-DD string as a LOCAL date (avoids UTC off-by-one issues).
 * Returns Invalid Date for nullish input.
 */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** DD/MM/YYYY */
export function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "12 Aug" or "12 Aug 2025" when not current year. */
export function formatDateShort(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${d.getDate()} ${months[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

/** YYYY-MM-DD in local time — the canonical wire format for the API. */
export function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODateString(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseDate(iso)!;
  d.setDate(d.getDate() + days);
  return toISODateString(d);
}

export function relativeTime(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDateShort(d);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = parseDate(iso);
  if (!target) return null;
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
}

/** Parse a user-typed currency string ("₹ 1,25,000.50") into a number. */
export function parseCurrencyInput(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}
