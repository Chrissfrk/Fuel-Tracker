import { describe, expect, it } from 'vitest';
import {
  REMINDER_PRESETS,
  isOneOffReminder,
  markReminderDone,
  nextDue,
  presetFor,
  reminderStatus,
  reminderStatuses,
  sortReminderStatuses,
} from '../src';
import { CAR2_ID, car, deleted, reminder } from './fixtures';

const c = car({ startOdometerKm: 50000, startDate: '2025-01-01' });
const ctx = (odometerKm: number, today = '2026-06-01', kmPerDay: number | null = 40) => ({
  car: c,
  odometerKm,
  today,
  kmPerDay,
});

describe('nextDue', () => {
  it('adds the km interval to the last done km, or the start odometer', () => {
    expect(nextDue(reminder({ everyKm: 10000, lastDoneKm: 60000 }), c).nextDueKm).toBe(70000);
    expect(nextDue(reminder({ everyKm: 10000 }), c).nextDueKm).toBe(60000);
  });
  it('adds the month interval to the last done date, or the start date', () => {
    expect(nextDue(reminder({ everyMonths: 12, lastDoneDate: '2026-01-31' }), c).nextDueDate).toBe(
      '2027-01-31',
    );
    expect(nextDue(reminder({ everyMonths: 6 }), c).nextDueDate).toBe('2025-07-01');
  });
  it('prefers a fixed due date', () => {
    expect(
      nextDue(reminder({ everyMonths: 12, dueDate: '2026-12-01', lastDoneDate: '2026-01-01' }), c)
        .nextDueDate,
    ).toBe('2026-12-01');
  });
});

describe('reminderStatus', () => {
  it('is ok when far away', () => {
    const s = reminderStatus(reminder({ everyKm: 10000, lastDoneKm: 60000 }), ctx(62000));
    expect(s.status).toBe('ok');
    expect(s.kmRemaining).toBe(8000);
    expect(s.estimatedKmDueDate).toBe('2026-12-18'); // 8000 / 40 = 200 days
  });
  it('is due soon within 1,000 km', () => {
    expect(reminderStatus(reminder({ everyKm: 10000, lastDoneKm: 60000 }), ctx(69000)).status).toBe(
      'due_soon',
    );
    expect(reminderStatus(reminder({ everyKm: 10000, lastDoneKm: 60000 }), ctx(70000)).status).toBe(
      'due_soon',
    );
  });
  it('is overdue past the km', () => {
    expect(reminderStatus(reminder({ everyKm: 10000, lastDoneKm: 60000 }), ctx(70001)).status).toBe(
      'overdue',
    );
  });
  it('is due soon within 30 days, and overdue after the date', () => {
    expect(reminderStatus(reminder({ dueDate: '2026-07-01' }), ctx(0)).status).toBe('due_soon');
    expect(reminderStatus(reminder({ dueDate: '2026-07-02' }), ctx(0)).status).toBe('ok');
    expect(reminderStatus(reminder({ dueDate: '2026-06-01' }), ctx(0)).status).toBe('due_soon');
    expect(reminderStatus(reminder({ dueDate: '2026-05-31' }), ctx(0)).status).toBe('overdue');
  });
  it('takes the worse of km and date', () => {
    const r = reminder({
      everyKm: 10000,
      lastDoneKm: 60000,
      everyMonths: 12,
      lastDoneDate: '2025-05-01',
    });
    expect(reminderStatus(r, ctx(61000)).status).toBe('overdue');
  });
  it('crosses the year boundary', () => {
    const s = reminderStatus(reminder({ dueDate: '2027-01-10' }), ctx(0, '2026-12-20'));
    expect(s.daysRemaining).toBe(21);
    expect(s.status).toBe('due_soon');
  });
  it('has no km estimate without a km/day figure', () => {
    expect(
      reminderStatus(reminder({ everyKm: 10000 }), ctx(0, '2026-06-01', null)).estimatedKmDueDate,
    ).toBeNull();
  });
});

describe('reminderStatuses', () => {
  it('sorts overdue first, then soonest, and skips deleted or unknown cars', () => {
    const list = reminderStatuses(
      [
        reminder({ id: 'a', title: 'ok', dueDate: '2027-01-01' }),
        reminder({ id: 'b', title: 'soon', dueDate: '2026-06-20' }),
        reminder({ id: 'c', title: 'late', dueDate: '2026-05-01' }),
        reminder({ id: 'd', title: 'sooner', dueDate: '2026-06-10' }),
        deleted(reminder({ id: 'e', dueDate: '2026-01-01' })),
        reminder({ id: 'f', carId: CAR2_ID, dueDate: '2026-01-01' }),
      ],
      new Map([[c.id, ctx(0)]]),
    );
    expect(list.map((s) => s.reminder.title)).toEqual(['late', 'sooner', 'soon', 'ok']);
    expect(sortReminderStatuses([])).toEqual([]);
  });
});

describe('markReminderDone', () => {
  it('resets last done km and date', () => {
    expect(
      markReminderDone(reminder({ everyKm: 10000 }), { date: '2026-06-01', km: 71000 }),
    ).toEqual({
      lastDoneKm: 71000,
      lastDoneDate: '2026-06-01',
      dueDate: null,
    });
  });
  it('rolls a fixed date forward by the interval', () => {
    const r = reminder({ everyMonths: 12, dueDate: '2026-12-01' });
    expect(markReminderDone(r, { date: '2026-11-20', km: null }).dueDate).toBe('2027-12-01');
    // Renewed two years late → still lands in the future.
    expect(markReminderDone(r, { date: '2028-12-05', km: null }).dueDate).toBe('2029-12-01');
  });
  it('keeps the previous km when none is given', () => {
    expect(
      markReminderDone(reminder({ everyMonths: 12, lastDoneKm: 5 }), {
        date: '2026-01-01',
        km: null,
      }).lastDoneKm,
    ).toBe(5);
  });
  it('identifies one-off reminders', () => {
    expect(isOneOffReminder(reminder({ dueDate: '2026-01-01' }))).toBe(true);
    expect(isOneOffReminder(reminder({ dueDate: '2026-01-01', everyMonths: 12 }))).toBe(false);
  });
});

describe('presets', () => {
  it('include the built-in presets', () => {
    expect(REMINDER_PRESETS.map((p) => p.title)).toEqual([
      'Oil & filter change',
      'Tire rotation',
      'KTEO',
      'Insurance renewal',
      'Road tax (τέλη κυκλοφορίας)',
      'Timing belt',
      'Brake check',
    ]);
    expect(presetFor('kteo')?.category).toBe('kteo');
    expect(presetFor('nope')).toBeNull();
  });
});
