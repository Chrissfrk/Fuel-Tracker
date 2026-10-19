import type { MonthStats } from './monthly';
import { daysInMonthOf, monthKey, safeDiv, shiftMonth } from './util';

export interface MonthProjection {
  month: string;
  soFar: number;
  projected: number;
  /** `pace` = extrapolated, `average` = 3-month average (early in the month), `actual` = past month. */
  method: 'pace' | 'average' | 'actual';
  daysElapsed: number;
  daysInMonth: number;
}

/**
 * Projected total spend for a month.
 *
 * Fuel is extrapolated at the current pace: (fuel so far ÷ days elapsed) × days in month.
 * Other expenses are counted as-is, because one-off bills (insurance, KTEO) would otherwise be
 * multiplied by the remaining days. While fewer than 7 days have passed, the 3-month average
 * total is used instead (but never less than what has already been spent).
 */
export function projectMonthSpend(rows: readonly MonthStats[], month: string, today: string) {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const current = byMonth.get(month);
  const soFar = current?.totalCost ?? 0;
  const days = daysInMonthOf(month);
  const todayMonth = monthKey(today);

  if (month < todayMonth) {
    return {
      month,
      soFar,
      projected: soFar,
      method: 'actual',
      daysElapsed: days,
      daysInMonth: days,
    } satisfies MonthProjection;
  }
  if (month > todayMonth) {
    return {
      month,
      soFar: 0,
      projected: 0,
      method: 'average',
      daysElapsed: 0,
      daysInMonth: days,
    } satisfies MonthProjection;
  }

  const daysElapsed = Number(today.slice(8, 10));
  if (daysElapsed < 7) {
    const prev = [1, 2, 3].map((i) => byMonth.get(shiftMonth(month, -i))).filter((m) => m != null);
    if (prev.length > 0) {
      const avg = prev.reduce((s, m) => s + m.totalCost, 0) / prev.length;
      return {
        month,
        soFar,
        projected: Math.max(avg, soFar),
        method: 'average',
        daysElapsed,
        daysInMonth: days,
      } satisfies MonthProjection;
    }
  }
  const fuel = current?.fuelCost ?? 0;
  const other = current?.expensesTotal ?? 0;
  return {
    month,
    soFar,
    projected: (fuel / daysElapsed) * days + other,
    method: 'pace',
    daysElapsed,
    daysInMonth: days,
  } satisfies MonthProjection;
}

export interface YearProjection {
  projected: number;
  monthsUsed: number;
  avgPerMonth: number;
}

/**
 * Projected spend for the next 12 months, based on the last 12 complete months (or as many as
 * the data covers). With no complete month yet, the current month's projection is used.
 */
export function projectYearSpend(rows: readonly MonthStats[], today: string): YearProjection {
  const current = monthKey(today);
  const past = rows.filter((r) => r.month < current && r.month >= shiftMonth(current, -12));
  if (past.length === 0) {
    const p = projectMonthSpend(rows, current, today).projected;
    return { projected: p * 12, monthsUsed: 0, avgPerMonth: p };
  }
  const avg = past.reduce((s, r) => s + r.totalCost, 0) / past.length;
  return { projected: avg * 12, monthsUsed: past.length, avgPerMonth: avg };
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetProgress {
  spent: number;
  budget: number;
  ratio: number;
  remaining: number;
  status: BudgetStatus;
}

/** `ok` below 80 %, `warning` from 80 % to 100 %, `over` above 100 %. */
export function budgetProgress(spent: number, budget: number): BudgetProgress {
  const ratio = safeDiv(spent, budget) ?? 0;
  const status: BudgetStatus = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok';
  return { spent, budget, ratio, remaining: budget - spent, status };
}
