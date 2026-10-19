import { combineStats, type MonthStats, type PeriodStats } from './monthly';
import { shiftMonth } from './util';

export const METRICS = [
  'km',
  'liters',
  'fuelCost',
  'expensesTotal',
  'totalCost',
  'avgPricePerLiter',
  'l100',
  'kmPerL',
  'trueCostPerKm',
  'fillupCount',
] as const;
export type MetricKey = (typeof METRICS)[number];

/** Which direction is an improvement. `null` = neutral (e.g. driving more is neither). */
export const METRIC_BETTER: Record<MetricKey, 'up' | 'down' | null> = {
  km: null,
  liters: null,
  fuelCost: 'down',
  expensesTotal: 'down',
  totalCost: 'down',
  avgPricePerLiter: 'down',
  l100: 'down',
  kmPerL: 'up',
  trueCostPerKm: 'down',
  fillupCount: null,
};

/** Metrics that add up across months; the rest are ratios of totals. */
const ADDITIVE: ReadonlySet<MetricKey> = new Set([
  'km',
  'liters',
  'fuelCost',
  'expensesTotal',
  'totalCost',
  'fillupCount',
]);

export interface Delta {
  base: number | null;
  diff: number | null;
  pct: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  /** `true` = improvement, `false` = worse, `null` = neutral or unknown. */
  good: boolean | null;
}

export interface Comparison {
  metric: MetricKey;
  value: number | null;
  vsLastMonth: Delta;
  vsLastYear: Delta;
  vs3MonthAvg: Delta;
}

export function delta(metric: MetricKey, value: number | null, base: number | null): Delta {
  if (value == null || base == null) {
    return { base, diff: null, pct: null, direction: null, good: null };
  }
  const diff = value - base;
  const eps = 1e-9;
  const direction = Math.abs(diff) < eps ? 'flat' : diff > 0 ? 'up' : 'down';
  const pct = Math.abs(base) < eps ? null : diff / Math.abs(base);
  const better = METRIC_BETTER[metric];
  const good = direction === 'flat' || better == null ? null : direction === better;
  return { base, diff, pct, direction, good };
}

function metricOf(stats: PeriodStats, metric: MetricKey): number | null {
  return stats[metric];
}

/**
 * Average of the (up to) three months before `month`, only counting months inside the data
 * range. Additive metrics are averaged per month; ratios are recomputed from the combined totals.
 */
export function threeMonthBaseline(
  byMonth: ReadonlyMap<string, MonthStats>,
  month: string,
  metric: MetricKey,
): number | null {
  const prev = [1, 2, 3].map((i) => byMonth.get(shiftMonth(month, -i))).filter((m) => m != null);
  if (prev.length === 0) return null;
  const combined = combineStats(prev);
  const v = metricOf(combined, metric);
  if (v == null) return null;
  return ADDITIVE.has(metric) ? v / prev.length : v;
}

/** Compare one month's metric against last month, the same month last year and the 3-month avg. */
export function compareMonth(
  rows: readonly MonthStats[],
  month: string,
  metric: MetricKey,
): Comparison {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const current = byMonth.get(month);
  const value = current ? metricOf(current, metric) : null;
  const lastMonth = byMonth.get(shiftMonth(month, -1));
  const lastYear = byMonth.get(shiftMonth(month, -12));
  return {
    metric,
    value,
    vsLastMonth: delta(metric, value, lastMonth ? metricOf(lastMonth, metric) : null),
    vsLastYear: delta(metric, value, lastYear ? metricOf(lastYear, metric) : null),
    vs3MonthAvg: delta(metric, value, threeMonthBaseline(byMonth, month, metric)),
  };
}

export function compareAllMetrics(
  rows: readonly MonthStats[],
  month: string,
): Record<MetricKey, Comparison> {
  return Object.fromEntries(METRICS.map((m) => [m, compareMonth(rows, month, m)])) as Record<
    MetricKey,
    Comparison
  >;
}
