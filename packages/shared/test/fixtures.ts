import type { Car, Expense, ExpenseCategory, Fillup, OdometerReading, Reminder } from '../src';

let seq = 0;
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const nextId = () => uuid(1000 + ++seq);

export const CAR_ID = uuid(1);
export const CAR2_ID = uuid(2);
export const USER_ID = 'user-1';

const base = () => {
  const t = ++seq;
  return { id: nextId(), createdAt: t, updatedAt: t, deletedAt: null, createdBy: USER_ID };
};

export function car(over: Partial<Car> = {}): Car {
  return {
    ...base(),
    id: CAR_ID,
    name: 'Polo',
    make: 'VW',
    model: 'Polo',
    plate: null,
    fuelType: '95',
    tankSizeLiters: 45,
    startOdometerKm: 50000,
    startDate: '2025-01-01',
    color: '#007aff',
    archived: false,
    ...over,
  };
}

export function fill(
  date: string,
  tripKm: number,
  liters: number,
  totalCost: number,
  over: Partial<Fillup> = {},
): Fillup {
  return {
    ...base(),
    carId: CAR_ID,
    date,
    tripKm,
    liters,
    totalCost,
    fullTank: true,
    missedPrevious: false,
    fuelType: null,
    station: null,
    note: null,
    receiptPhotoId: null,
    ...over,
  };
}

export function exp(
  date: string,
  category: ExpenseCategory,
  amount: number,
  over: Partial<Expense> = {},
): Expense {
  return {
    ...base(),
    carId: CAR_ID,
    date,
    category,
    amount,
    odometerKm: null,
    note: null,
    receiptPhotoId: null,
    ...over,
  };
}

export function reading(
  date: string,
  odometerKm: number,
  over: Partial<OdometerReading> = {},
): OdometerReading {
  return { ...base(), carId: CAR_ID, date, odometerKm, source: 'manual', ...over };
}

export function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    ...base(),
    carId: CAR_ID,
    type: 'oil',
    title: 'Oil & filter change',
    everyKm: null,
    everyMonths: null,
    lastDoneKm: null,
    lastDoneDate: null,
    dueDate: null,
    ...over,
  };
}

export const deleted = <T extends { deletedAt: number | null }>(r: T): T => ({
  ...r,
  deletedAt: 999,
});
