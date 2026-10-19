import type { Expense } from '../schemas';
import { computeSegments, economyOf, pricePerLiter, validSegments, type Segment } from './economy';
import { combineStats, monthlyStats } from './monthly';
import { alive, monthKey, monthRange } from './util';

type FillupInput = Parameters<typeof computeSegments>[0][number];
type ExpenseInput = Pick<Expense, 'date' | 'category' | 'amount' | 'deletedAt'>;

export interface PricePoint {
  fillupId: string;
  date: string;
  pricePerLiter: number;
  station: string | null;
}

export interface AllTimeStats {
  firstDate: string | null;
  km: number;
  liters: number;
  fuelCost: number;
  expensesTotal: number;
  totalCost: number;
  fillupCount: number;
  l100: number | null;
  kmPerL: number | null;
  trueCostPerKm: number | null;
  avgPricePerLiter: number | null;
  bestSegment: Segment | null;
  worstSegment: Segment | null;
  cheapestFill: PricePoint | null;
  priciestFill: PricePoint | null;
  /** Total spend ÷ number of calendar months from the first record through `today`. */
  avgMonthlySpend: number | null;
  monthsCovered: number;
}

export function allTimeStats(
  data: { fillups: readonly FillupInput[]; expenses: readonly ExpenseInput[] },
  today: string,
): AllTimeStats {
  const fillups = alive(data.fillups);
  const expenses = alive(data.expenses);
  const segments = computeSegments(fillups);
  const totals = combineStats(monthlyStats({ fillups, expenses }, { segments }));
  const economy = economyOf(segments);

  const valid = validSegments(segments);
  let best: Segment | null = null;
  let worst: Segment | null = null;
  for (const s of valid) {
    if (best == null || s.l100! < best.l100!) best = s;
    if (worst == null || s.l100! > worst.l100!) worst = s;
  }

  let cheapest: PricePoint | null = null;
  let priciest: PricePoint | null = null;
  for (const f of fillups) {
    const ppl = pricePerLiter(f);
    if (ppl == null) continue;
    const p = { fillupId: f.id, date: f.date, pricePerLiter: ppl, station: f.station ?? null };
    if (cheapest == null || ppl < cheapest.pricePerLiter) cheapest = p;
    if (priciest == null || ppl > priciest.pricePerLiter) priciest = p;
  }

  const dates = [...fillups.map((f) => f.date), ...expenses.map((e) => e.date)].sort();
  const firstDate = dates[0] ?? null;
  const monthsCovered = firstDate
    ? monthRange(monthKey(firstDate), monthKey(today > firstDate ? today : firstDate)).length
    : 0;

  return {
    firstDate,
    km: totals.km,
    liters: totals.liters,
    fuelCost: totals.fuelCost,
    expensesTotal: totals.expensesTotal,
    totalCost: totals.totalCost,
    fillupCount: totals.fillupCount,
    l100: economy.l100,
    kmPerL: economy.kmPerL,
    trueCostPerKm: totals.trueCostPerKm,
    avgPricePerLiter: totals.avgPricePerLiter,
    bestSegment: best,
    worstSegment: worst,
    cheapestFill: cheapest,
    priciestFill: priciest,
    avgMonthlySpend: monthsCovered > 0 ? totals.totalCost / monthsCovered : null,
    monthsCovered,
  };
}
