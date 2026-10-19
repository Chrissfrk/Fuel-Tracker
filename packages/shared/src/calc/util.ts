import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  parseISO,
} from 'date-fns';

export interface SoftDeletable {
  deletedAt: number | null;
}

/** Drop soft-deleted records. Every calc entry point calls this first. */
export function alive<T extends SoftDeletable>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.deletedAt == null);
}

interface Dated {
  date: string;
  createdAt: number;
  id: string;
}

/** Chronological order: date, then creation time, then id (stable across devices). */
export function compareChrono(a: Dated, b: Dated): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortChrono<T extends Dated>(rows: readonly T[]): T[] {
  return [...rows].sort(compareChrono);
}

/** `true` when `a` happened strictly after `b` in chronological order. */
export function isAfter(
  a: Pick<Dated, 'date' | 'createdAt'>,
  b: Pick<Dated, 'date' | 'createdAt'>,
) {
  return a.date > b.date || (a.date === b.date && a.createdAt > b.createdAt);
}

export const monthKey = (isoDate: string) => isoDate.slice(0, 7);

export function safeDiv(a: number, b: number): number | null {
  return b === 0 || !Number.isFinite(a) || !Number.isFinite(b) ? null : a / b;
}

export const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

export const toIso = (d: Date) => format(d, 'yyyy-MM-dd');

export function daysBetween(fromIso: string, toIsoDate: string): number {
  return differenceInCalendarDays(parseISO(toIsoDate), parseISO(fromIso));
}

export const addMonthsIso = (iso: string, months: number) =>
  toIso(addMonths(parseISO(iso), months));
export const addDaysIso = (iso: string, days: number) => toIso(addDays(parseISO(iso), days));

export function daysInMonthOf(month: string): number {
  return getDaysInMonth(parseISO(`${month}-01`));
}

/** `2026-01` + 1 → `2026-02`; handles year boundaries and negative offsets. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Inclusive list of month keys from `from` to `to`. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  let m = from;
  while (m <= to) {
    out.push(m);
    m = shiftMonth(m, 1);
  }
  return out;
}

export function groupBy<T, K>(rows: readonly T[], key: (r: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}
