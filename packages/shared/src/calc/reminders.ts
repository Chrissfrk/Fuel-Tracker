import type { Car, ExpenseCategory, Reminder } from '../schemas';
import { addDaysIso, addMonthsIso, alive, daysBetween } from './util';

export interface ReminderPreset {
  type: string;
  title: string;
  everyKm: number | null;
  everyMonths: number | null;
  /** Expense category used when marking it done creates an expense. */
  category: ExpenseCategory;
  /** Fixed-date reminders ask for a due date instead of a last-done date. */
  fixedDate: boolean;
}

export const REMINDER_PRESETS: readonly ReminderPreset[] = [
  {
    type: 'oil',
    title: 'Oil & filter change',
    everyKm: 10000,
    everyMonths: 12,
    category: 'service',
    fixedDate: false,
  },
  {
    type: 'tire_rotation',
    title: 'Tire rotation',
    everyKm: 10000,
    everyMonths: null,
    category: 'tires',
    fixedDate: false,
  },
  {
    type: 'kteo',
    title: 'KTEO',
    everyKm: null,
    everyMonths: 24,
    category: 'kteo',
    fixedDate: true,
  },
  {
    type: 'insurance',
    title: 'Insurance renewal',
    everyKm: null,
    everyMonths: 12,
    category: 'insurance',
    fixedDate: true,
  },
  {
    type: 'road_tax',
    title: 'Road tax (τέλη κυκλοφορίας)',
    everyKm: null,
    everyMonths: 12,
    category: 'road_tax',
    fixedDate: true,
  },
  {
    type: 'timing_belt',
    title: 'Timing belt',
    everyKm: 90000,
    everyMonths: 60,
    category: 'repair',
    fixedDate: false,
  },
  {
    type: 'brakes',
    title: 'Brake check',
    everyKm: 20000,
    everyMonths: 12,
    category: 'service',
    fixedDate: false,
  },
];

export const presetFor = (type: string) => REMINDER_PRESETS.find((p) => p.type === type) ?? null;

export const DUE_SOON_KM = 1000;
export const DUE_SOON_DAYS = 30;

export type ReminderState = 'overdue' | 'due_soon' | 'ok';

export interface ReminderStatus {
  reminder: Reminder;
  nextDueKm: number | null;
  nextDueDate: string | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
  /** When a km-based reminder will likely fall due, from the recent km/day. */
  estimatedKmDueDate: string | null;
  status: ReminderState;
}

type ReminderInput = Pick<
  Reminder,
  'everyKm' | 'everyMonths' | 'lastDoneKm' | 'lastDoneDate' | 'dueDate'
>;

export function nextDue(r: ReminderInput, car: Pick<Car, 'startOdometerKm' | 'startDate'>) {
  const nextDueKm = r.everyKm != null ? (r.lastDoneKm ?? car.startOdometerKm) + r.everyKm : null;
  let nextDueDate: string | null = null;
  if (r.dueDate) nextDueDate = r.dueDate;
  else if (r.everyMonths != null)
    nextDueDate = addMonthsIso(r.lastDoneDate ?? car.startDate, r.everyMonths);
  return { nextDueKm, nextDueDate };
}

export function reminderStatus(
  reminder: Reminder,
  ctx: {
    car: Pick<Car, 'startOdometerKm' | 'startDate'>;
    odometerKm: number;
    today: string;
    kmPerDay: number | null;
  },
): ReminderStatus {
  const { nextDueKm, nextDueDate } = nextDue(reminder, ctx.car);
  const kmRemaining = nextDueKm == null ? null : nextDueKm - ctx.odometerKm;
  const daysRemaining = nextDueDate == null ? null : daysBetween(ctx.today, nextDueDate);
  const estimatedKmDueDate =
    kmRemaining != null && ctx.kmPerDay != null && ctx.kmPerDay > 0
      ? addDaysIso(ctx.today, Math.max(0, Math.round(kmRemaining / ctx.kmPerDay)))
      : null;

  let status: ReminderState = 'ok';
  if ((kmRemaining != null && kmRemaining < 0) || (daysRemaining != null && daysRemaining < 0)) {
    status = 'overdue';
  } else if (
    (kmRemaining != null && kmRemaining <= DUE_SOON_KM) ||
    (daysRemaining != null && daysRemaining <= DUE_SOON_DAYS)
  ) {
    status = 'due_soon';
  }
  return {
    reminder,
    nextDueKm,
    nextDueDate,
    kmRemaining,
    daysRemaining,
    estimatedKmDueDate,
    status,
  };
}

const SEVERITY: Record<ReminderState, number> = { overdue: 0, due_soon: 1, ok: 2 };

/** Soonest-first by the earliest of the date due and the estimated km due date. */
function urgencyDate(s: ReminderStatus): string {
  const dates = [s.nextDueDate, s.estimatedKmDueDate].filter((d): d is string => d != null);
  return dates.sort()[0] ?? '9999-12-31';
}

export function sortReminderStatuses(list: readonly ReminderStatus[]): ReminderStatus[] {
  return [...list].sort(
    (a, b) =>
      SEVERITY[a.status] - SEVERITY[b.status] ||
      urgencyDate(a).localeCompare(urgencyDate(b)) ||
      (a.kmRemaining ?? Infinity) - (b.kmRemaining ?? Infinity),
  );
}

/** Statuses for all live reminders of the given cars, most urgent first. */
export function reminderStatuses(
  reminders: readonly Reminder[],
  ctxByCar: ReadonlyMap<string, Parameters<typeof reminderStatus>[1]>,
): ReminderStatus[] {
  const out: ReminderStatus[] = [];
  for (const r of alive(reminders)) {
    const ctx = ctxByCar.get(r.carId);
    if (ctx) out.push(reminderStatus(r, ctx));
  }
  return sortReminderStatuses(out);
}

/** A fixed date with no interval: once done, there is nothing left to remind about. */
export const isOneOffReminder = (r: ReminderInput) =>
  r.everyKm == null && r.everyMonths == null && r.dueDate != null;

/**
 * The reminder fields to write when it's marked done on `date` at `km`.
 * Fixed-date reminders with an interval roll the due date forward past the done date.
 * (One-off reminders keep their date; the caller removes them instead — see `isOneOffReminder`.)
 */
export function markReminderDone(
  r: ReminderInput,
  done: { date: string; km: number | null },
): Pick<Reminder, 'lastDoneKm' | 'lastDoneDate' | 'dueDate'> {
  let dueDate = r.dueDate;
  if (dueDate && r.everyMonths != null) {
    dueDate = addMonthsIso(dueDate, r.everyMonths);
    // Renewed late? Keep rolling until the due date is after the done date.
    while (dueDate <= done.date) dueDate = addMonthsIso(dueDate, r.everyMonths);
  }
  return { lastDoneKm: done.km ?? r.lastDoneKm, lastDoneDate: done.date, dueDate };
}
