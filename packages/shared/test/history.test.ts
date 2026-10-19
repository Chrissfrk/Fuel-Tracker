import { describe, expect, it } from 'vitest';
import { filterHistory, groupHistory, toHistoryItems } from '../src';
import { CAR2_ID, deleted, exp, fill, reading } from './fixtures';

const items = toHistoryItems({
  fillups: [
    fill('2026-05-01', 500, 30, 50, { station: 'Shell Kifisias' }),
    fill('2026-06-02', 500, 30, 55, { carId: CAR2_ID, createdBy: 'maria' }),
    deleted(fill('2026-06-03', 500, 30, 99)),
  ],
  expenses: [
    exp('2026-06-05', 'service', 120, { note: 'Oil change' }),
    exp('2025-12-31', 'tolls', 3),
  ],
  odometerReadings: [reading('2026-06-06', 84000)],
});

describe('groupHistory', () => {
  it('groups newest first by month with totals, skipping deleted', () => {
    const months = groupHistory(items);
    expect(months.map((m) => m.month)).toEqual(['2026-06', '2026-05', '2025-12']);
    const june = months[0]!;
    expect(june.items.map((i) => i.kind)).toEqual(['odometer', 'expense', 'fillup']);
    expect(june.fuelCost).toBe(55);
    expect(june.expensesTotal).toBe(120);
    expect(june.total).toBe(175);
  });
  it('is empty with no data', () => {
    expect(groupHistory([])).toEqual([]);
  });
});

describe('filterHistory', () => {
  it('filters by car, kind, category, member and dates', () => {
    expect(filterHistory(items, { carIds: [CAR2_ID] })).toHaveLength(1);
    expect(filterHistory(items, { kinds: ['expense'] })).toHaveLength(2);
    expect(filterHistory(items, { categories: ['tolls'] })).toHaveLength(1);
    expect(filterHistory(items, { createdBy: 'maria' })).toHaveLength(1);
    expect(filterHistory(items, { from: '2026-06-01', to: '2026-06-05' })).toHaveLength(2);
  });
  it('searches notes and stations, case-insensitively', () => {
    expect(filterHistory(items, { search: 'kifisias' })).toHaveLength(1);
    expect(filterHistory(items, { search: 'OIL' })).toHaveLength(1);
    expect(filterHistory(items, { search: '' })).toHaveLength(items.length);
  });
});
