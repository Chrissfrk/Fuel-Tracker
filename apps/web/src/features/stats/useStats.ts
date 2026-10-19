import { useMemo } from 'react';
import {
  allTimeStats,
  combineStats,
  compareMonth,
  computeSegments,
  expenseGroupTotals,
  monthKey,
  monthlyStats,
  pricePerLiter,
  rollingEconomy,
  seasonalEconomy,
  shiftMonth,
  sortChrono,
  stationStats,
  todayIso,
  type Car,
  type Expense,
  type Fillup,
} from '@fuel/shared';
import { FUEL_LABEL } from '../labels';

export type Range = '3m' | '6m' | '1y' | 'all';
const RANGE_MONTHS: Record<Exclude<Range, 'all'>, number> = { '3m': 3, '6m': 6, '1y': 12 };

/** All Stats-screen figures, built from calc.ts. */
export function useStats(cars: Car[], fillups: Fillup[], expenses: Expense[], range: Range) {
  return useMemo(() => {
    const today = todayIso();
    const current = monthKey(today);
    const segments = computeSegments(fillups);
    const allMonths = monthlyStats({ fillups, expenses }, { to: current, segments });
    const from =
      range === 'all'
        ? (allMonths[0]?.month ?? current)
        : shiftMonth(current, -(RANGE_MONTHS[range] - 1));
    const fromDate = `${from}-01`;
    const months = allMonths.filter((m) => m.month >= from);

    const table = [...months].reverse().map((m) => ({
      ...m,
      totalVsLast: compareMonth(allMonths, m.month, 'totalCost').vsLastMonth,
      l100VsLast: compareMonth(allMonths, m.month, 'l100').vsLastMonth,
      pplVsLast: compareMonth(allMonths, m.month, 'avgPricePerLiter').vsLastMonth,
    }));

    const inRange = fillups.filter((f) => f.date >= fromDate);
    const economy = rollingEconomy(segments, 5).filter((p) => p.segment.endDate >= fromDate);
    const prices = sortChrono(inRange).map((f) => ({
      carId: f.carId,
      date: f.date,
      ppl: pricePerLiter(f)!,
      station: f.station,
    }));

    const spend = months.map((m) => ({
      month: m.month,
      fuel: m.fuelCost,
      ...expenseGroupTotals(m.expensesByCategory),
    }));
    const kmByCar = months.map((m) => ({
      month: m.month,
      total: m.km,
      perCar: Object.fromEntries(
        cars.map((c) => [
          c.id,
          inRange
            .filter((f) => f.carId === c.id && monthKey(f.date) === m.month)
            .reduce((s, f) => s + f.tripKm, 0),
        ]),
      ),
    }));

    const totals = combineStats(months);
    const categoryTotals = {
      fuel: totals.fuelCost,
      ...expenseGroupTotals(totals.expensesByCategory),
    };

    // Mixed fuel types make station prices incomparable: split stations by fuel when needed.
    const fuelTypes = new Set(
      inRange.map((f) => f.fuelType ?? cars.find((c) => c.id === f.carId)?.fuelType),
    );
    const stationInput =
      fuelTypes.size > 1
        ? inRange.map((f) => {
            const ft = f.fuelType ?? cars.find((c) => c.id === f.carId)?.fuelType ?? 'other';
            return { ...f, station: f.station ? `${f.station} · ${FUEL_LABEL[ft]}` : null };
          })
        : inRange;
    const stations = stationStats(stationInput)
      .slice(0, 8)
      .sort((a, b) => (a.avgPricePerLiter ?? 0) - (b.avgPricePerLiter ?? 0));

    return {
      months,
      table,
      economy,
      prices,
      spend,
      kmByCar,
      categoryTotals,
      stations,
      seasonal: seasonalEconomy(fillups, segments),
      allTime: allTimeStats({ fillups, expenses }, today),
      hasData: fillups.length + expenses.length > 0,
    };
  }, [cars, fillups, expenses, range]);
}
