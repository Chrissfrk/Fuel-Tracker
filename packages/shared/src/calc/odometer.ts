import type { Car, Expense, Fillup, OdometerReading } from '../schemas';
import { alive, daysBetween, isAfter } from './util';

export interface OdometerBase {
  km: number;
  date: string;
  createdAt: number;
  source: 'start' | 'manual' | 'expense';
}

type CarInput = Pick<Car, 'id' | 'startOdometerKm' | 'startDate'>;
type ReadingInput = Pick<
  OdometerReading,
  'carId' | 'date' | 'createdAt' | 'odometerKm' | 'deletedAt'
>;
type ExpenseInput = Pick<Expense, 'carId' | 'date' | 'createdAt' | 'odometerKm' | 'deletedAt'>;
type FillupInput = Pick<Fillup, 'carId' | 'date' | 'createdAt' | 'tripKm' | 'deletedAt'>;

/** Latest real odometer reading: the car's start value, a manual reading, or an expense's odometer. */
export function latestOdometerReading(
  car: CarInput,
  readings: readonly ReadingInput[],
  expenses: readonly ExpenseInput[],
): OdometerBase {
  // Start value sorts before anything logged on the start date.
  let base: OdometerBase = {
    km: car.startOdometerKm,
    date: car.startDate,
    createdAt: Number.NEGATIVE_INFINITY,
    source: 'start',
  };
  for (const r of alive(readings)) {
    if (r.carId !== car.id) continue;
    const c = { km: r.odometerKm, date: r.date, createdAt: r.createdAt, source: 'manual' as const };
    if (isAfter(c, base)) base = c;
  }
  for (const e of alive(expenses)) {
    if (e.carId !== car.id || e.odometerKm == null) continue;
    const c = {
      km: e.odometerKm,
      date: e.date,
      createdAt: e.createdAt,
      source: 'expense' as const,
    };
    if (isAfter(c, base)) base = c;
  }
  return base;
}

export interface OdometerEstimate {
  km: number;
  base: OdometerBase;
  /** Trip km of fill-ups logged after the base reading. */
  addedKm: number;
}

/** Latest real reading + Σ trip km of fill-ups after that reading. */
export function estimatedOdometer(
  car: CarInput,
  fillups: readonly FillupInput[],
  readings: readonly ReadingInput[],
  expenses: readonly ExpenseInput[],
): OdometerEstimate {
  const base = latestOdometerReading(car, readings, expenses);
  let added = 0;
  for (const f of alive(fillups)) {
    if (f.carId === car.id && isAfter(f, base)) added += f.tripKm;
  }
  return { km: base.km + added, base, addedKm: added };
}

/**
 * Recent average km per day for one car, from fill-ups in the last `windowDays`.
 * Falls back to the whole history when the window has under two weeks of data.
 */
export function averageKmPerDay(
  fillups: readonly FillupInput[],
  today: string,
  windowDays = 90,
): number | null {
  const rows = alive(fillups).filter((f) => f.date <= today);
  if (rows.length === 0) return null;
  const first = rows.reduce((m, f) => (f.date < m ? f.date : m), rows[0]!.date);
  const span = (from: string) => Math.max(1, daysBetween(from, today));
  const windowRows = rows.filter((f) => daysBetween(f.date, today) <= windowDays);
  const historyDays = span(first);
  if (historyDays >= 14 && windowRows.length > 0) {
    const days = Math.min(windowDays, historyDays);
    return windowRows.reduce((s, f) => s + f.tripKm, 0) / days;
  }
  return rows.reduce((s, f) => s + f.tripKm, 0) / historyDays;
}
