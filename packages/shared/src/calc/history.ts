import type { Expense, Fillup, OdometerReading } from '../schemas';
import { alive, compareChrono, monthKey } from './util';

export type HistoryItem =
  | { kind: 'fillup'; record: Fillup }
  | { kind: 'expense'; record: Expense }
  | { kind: 'odometer'; record: OdometerReading };

export interface HistoryMonth {
  month: string;
  items: HistoryItem[];
  fuelCost: number;
  expensesTotal: number;
  total: number;
}

const amountOf = (i: HistoryItem) =>
  i.kind === 'fillup' ? i.record.totalCost : i.kind === 'expense' ? i.record.amount : 0;

/** Combined reverse-chronological list grouped by month, with month totals. */
export function groupHistory(items: readonly HistoryItem[]): HistoryMonth[] {
  const liveItems = items.filter((i) => i.record.deletedAt == null);
  const sorted = [...liveItems].sort((a, b) => compareChrono(b.record, a.record));
  const months: HistoryMonth[] = [];
  for (const item of sorted) {
    const m = monthKey(item.record.date);
    let group = months.at(-1);
    if (!group || group.month !== m) {
      group = { month: m, items: [], fuelCost: 0, expensesTotal: 0, total: 0 };
      months.push(group);
    }
    group.items.push(item);
    if (item.kind === 'fillup') group.fuelCost += amountOf(item);
    if (item.kind === 'expense') group.expensesTotal += amountOf(item);
    group.total += amountOf(item);
  }
  return months;
}

export interface HistoryFilter {
  carIds?: readonly string[] | null;
  kinds?: readonly HistoryItem['kind'][] | null;
  categories?: readonly Expense['category'][] | null;
  createdBy?: string | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
}

export function filterHistory(items: readonly HistoryItem[], f: HistoryFilter): HistoryItem[] {
  const q = f.search?.trim().toLowerCase() ?? '';
  return items.filter((i) => {
    const r = i.record;
    if (f.carIds && f.carIds.length > 0 && !f.carIds.includes(r.carId)) return false;
    if (f.kinds && f.kinds.length > 0 && !f.kinds.includes(i.kind)) return false;
    if (f.categories && f.categories.length > 0) {
      if (i.kind !== 'expense' || !f.categories.includes(i.record.category)) return false;
    }
    if (f.createdBy && r.createdBy !== f.createdBy) return false;
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    if (q) {
      const hay =
        i.kind === 'fillup'
          ? `${i.record.note ?? ''} ${i.record.station ?? ''}`
          : i.kind === 'expense'
            ? `${i.record.note ?? ''} ${i.record.category}`
            : '';
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function toHistoryItems(data: {
  fillups: readonly Fillup[];
  expenses: readonly Expense[];
  odometerReadings?: readonly OdometerReading[];
}): HistoryItem[] {
  return [
    ...alive(data.fillups).map((record) => ({ kind: 'fillup' as const, record })),
    ...alive(data.expenses).map((record) => ({ kind: 'expense' as const, record })),
    ...alive(data.odometerReadings ?? []).map((record) => ({ kind: 'odometer' as const, record })),
  ];
}
