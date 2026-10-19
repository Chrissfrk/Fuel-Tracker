import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type Fillup } from '../schemas';
import { computeSegments, type Segment } from './economy';
import { alive, monthKey, monthRange, safeDiv } from './util';

export type CategoryTotals = Record<ExpenseCategory, number>;

export const emptyCategoryTotals = (): CategoryTotals =>
  Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as CategoryTotals;

/** Raw additive sums for a period. Ratios are derived from these, never averaged. */
export interface PeriodTotals {
  km: number;
  liters: number;
  fuelCost: number;
  fillupCount: number;
  /** Liters and km of valid full-tank segments that closed in the period. */
  economyLiters: number;
  economyKm: number;
  expensesByCategory: CategoryTotals;
  expensesTotal: number;
}

export interface PeriodStats extends PeriodTotals {
  totalCost: number;
  avgPricePerLiter: number | null;
  l100: number | null;
  kmPerL: number | null;
  /** (fuel + all expenses) ÷ km */
  trueCostPerKm: number | null;
  fuelCostPer100Km: number | null;
}

export interface MonthStats extends PeriodStats {
  month: string;
}

export function emptyTotals(): PeriodTotals {
  return {
    km: 0,
    liters: 0,
    fuelCost: 0,
    fillupCount: 0,
    economyLiters: 0,
    economyKm: 0,
    expensesByCategory: emptyCategoryTotals(),
    expensesTotal: 0,
  };
}

export function addTotals(a: PeriodTotals, b: PeriodTotals): PeriodTotals {
  const cats = emptyCategoryTotals();
  for (const c of EXPENSE_CATEGORIES) cats[c] = a.expensesByCategory[c] + b.expensesByCategory[c];
  return {
    km: a.km + b.km,
    liters: a.liters + b.liters,
    fuelCost: a.fuelCost + b.fuelCost,
    fillupCount: a.fillupCount + b.fillupCount,
    economyLiters: a.economyLiters + b.economyLiters,
    economyKm: a.economyKm + b.economyKm,
    expensesByCategory: cats,
    expensesTotal: a.expensesTotal + b.expensesTotal,
  };
}

export function deriveStats(t: PeriodTotals): PeriodStats {
  const totalCost = t.fuelCost + t.expensesTotal;
  const l100 = safeDiv(t.economyLiters, t.economyKm);
  const fuelPerKm = safeDiv(t.fuelCost, t.km);
  return {
    ...t,
    totalCost,
    avgPricePerLiter: safeDiv(t.fuelCost, t.liters),
    l100: l100 == null ? null : l100 * 100,
    kmPerL: safeDiv(t.economyKm, t.economyLiters),
    trueCostPerKm: safeDiv(totalCost, t.km),
    fuelCostPer100Km: fuelPerKm == null ? null : fuelPerKm * 100,
  };
}

export const combineStats = (months: readonly PeriodTotals[]): PeriodStats =>
  deriveStats(months.reduce(addTotals, emptyTotals()));

type FillupInput = Parameters<typeof computeSegments>[0][number] & Pick<Fillup, 'date'>;
type ExpenseInput = Pick<Expense, 'date' | 'category' | 'amount' | 'deletedAt'>;

export interface MonthlyOptions {
  /** First month to include (`YYYY-MM`). Defaults to the earliest record. */
  from?: string;
  /** Last month to include. Defaults to the latest record. */
  to?: string;
  /** Precomputed segments (e.g. shared with other views). */
  segments?: Segment[];
}

/**
 * One row per month (gaps included as empty months).
 * Works for one car or many: segments are always built per car, then attributed to the
 * month their closing fill-up falls in.
 */
export function monthlyStats(
  data: { fillups: readonly FillupInput[]; expenses: readonly ExpenseInput[] },
  opts: MonthlyOptions = {},
): MonthStats[] {
  const fillups = alive(data.fillups);
  const expenses = alive(data.expenses);
  const segments = opts.segments ?? computeSegments(fillups);

  const buckets = new Map<string, PeriodTotals>();
  const bucket = (m: string) => {
    let b = buckets.get(m);
    if (!b) buckets.set(m, (b = emptyTotals()));
    return b;
  };

  for (const f of fillups) {
    const b = bucket(monthKey(f.date));
    b.km += f.tripKm;
    b.liters += f.liters;
    b.fuelCost += f.totalCost;
    b.fillupCount += 1;
  }
  for (const s of segments) {
    if (s.status !== 'valid') continue;
    const b = bucket(monthKey(s.endDate));
    b.economyLiters += s.liters;
    b.economyKm += s.km;
  }
  for (const e of expenses) {
    const b = bucket(monthKey(e.date));
    b.expensesByCategory[e.category] += e.amount;
    b.expensesTotal += e.amount;
  }

  const keys = [...buckets.keys()].sort();
  const from = opts.from ?? keys[0];
  const to = opts.to ?? keys[keys.length - 1];
  if (from == null || to == null) return [];
  return monthRange(from, to).map((month) => ({
    month,
    ...deriveStats(buckets.get(month) ?? emptyTotals()),
  }));
}

/** Find a month row, or an empty one when there was no activity. */
export function monthOf(rows: readonly MonthStats[], month: string): MonthStats {
  return rows.find((r) => r.month === month) ?? { month, ...deriveStats(emptyTotals()) };
}

/** Expense categories folded into a few groups for charts (keeps stacks readable). */
export const EXPENSE_GROUPS = [
  { key: 'maintenance', label: 'Maintenance', categories: ['service', 'repair', 'tires'] },
  { key: 'fees', label: 'Insurance & fees', categories: ['insurance', 'road_tax', 'kteo'] },
  { key: 'driving', label: 'Tolls, parking & wash', categories: ['tolls', 'parking', 'wash'] },
  { key: 'other', label: 'Other', categories: ['other'] },
] as const satisfies readonly {
  key: string;
  label: string;
  categories: readonly ExpenseCategory[];
}[];
export type ExpenseGroupKey = (typeof EXPENSE_GROUPS)[number]['key'];

export function expenseGroupTotals(cats: CategoryTotals): Record<ExpenseGroupKey, number> {
  const out = {} as Record<ExpenseGroupKey, number>;
  for (const g of EXPENSE_GROUPS) {
    out[g.key] = g.categories.reduce((s, c) => s + cats[c as ExpenseCategory], 0);
  }
  return out;
}
