import { useMemo } from 'react';
import {
  averageKmPerDay,
  budgetProgress,
  compareAllMetrics,
  computeSegments,
  economyOf,
  estimatedOdometer,
  monthKey,
  monthOf,
  monthlyStats,
  projectMonthSpend,
  projectYearSpend,
  reminderStatuses,
  sortChrono,
  todayIso,
  type Budget,
  type Car,
  type Expense,
  type Fillup,
  type OdometerReading,
  type Reminder,
} from '@fuel/shared';

export interface DashboardInput {
  cars: Car[];
  selectedCars: Car[];
  isAll: boolean;
  fillups: Fillup[];
  expenses: Expense[];
  readings: OdometerReading[];
  reminders: Reminder[];
  budgets: Budget[];
}

/** Everything the Home screen shows, derived from calc.ts. */
export function useDashboard(input: DashboardInput) {
  const { selectedCars, isAll, fillups, expenses, readings, reminders, budgets } = input;
  return useMemo(() => {
    const today = todayIso();
    const month = monthKey(today);
    const segments = computeSegments(fillups);
    const monthly = monthlyStats({ fillups, expenses }, { to: month, segments });
    const current = monthOf(monthly, month);
    const comparisons = compareAllMetrics(monthly, month);
    const allTimeEconomy = economyOf(segments);
    const allTimeLiters = fillups.reduce((s, f) => s + f.liters, 0);
    const allTimeCost = fillups.reduce((s, f) => s + f.totalCost, 0);

    const projection = projectMonthSpend(monthly, month, today);
    const yearProjection = projectYearSpend(monthly, today);

    const budget = isAll
      ? budgets.find((b) => b.carId == null)
      : budgets.find((b) => b.carId === selectedCars[0]?.id);
    const budgetState = budget ? budgetProgress(current.totalCost, budget.monthlyAmount) : null;

    const ctx = new Map(
      selectedCars.map((car) => {
        const carFills = fillups.filter((f) => f.carId === car.id);
        return [
          car.id,
          {
            car,
            odometerKm: estimatedOdometer(car, carFills, readings, expenses).km,
            today,
            kmPerDay: averageKmPerDay(carFills, today),
          },
        ] as const;
      }),
    );
    const reminderList = reminderStatuses(reminders, ctx);
    const odometer =
      !isAll && selectedCars[0]
        ? estimatedOdometer(selectedCars[0], fillups, readings, expenses)
        : null;
    const recentFillups = sortChrono(fillups).reverse().slice(0, 3);

    return {
      today,
      month,
      current,
      comparisons,
      /** This month's economy, or all-time when no full tank closed this month yet. */
      l100: current.l100 ?? allTimeEconomy.l100,
      l100IsAllTime: current.l100 == null,
      pricePerLiter:
        current.avgPricePerLiter ?? (allTimeLiters > 0 ? allTimeCost / allTimeLiters : null),
      priceIsAllTime: current.avgPricePerLiter == null,
      projection,
      yearProjection,
      budget,
      budgetState,
      reminders: reminderList,
      odometer,
      recentFillups,
      hasData: fillups.length > 0 || expenses.length > 0,
    };
  }, [selectedCars, isAll, fillups, expenses, readings, reminders, budgets]);
}
