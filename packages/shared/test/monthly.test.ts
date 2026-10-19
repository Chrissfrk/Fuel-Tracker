import { describe, expect, it } from 'vitest';
import { combineStats, monthOf, monthlyStats } from '../src';
import { CAR2_ID, deleted, exp, fill } from './fixtures';

describe('monthlyStats', () => {
  it('returns no rows for no data', () => {
    expect(monthlyStats({ fillups: [], expenses: [] })).toEqual([]);
  });

  it('aggregates fuel totals and derives ratios from totals', () => {
    const rows = monthlyStats({
      fillups: [fill('2026-03-02', 500, 30, 54), fill('2026-03-20', 500, 40, 70)],
      expenses: [],
    });
    expect(rows).toHaveLength(1);
    const m = rows[0]!;
    expect(m.month).toBe('2026-03');
    expect(m.km).toBe(1000);
    expect(m.liters).toBe(70);
    expect(m.fuelCost).toBe(124);
    expect(m.fillupCount).toBe(2);
    expect(m.avgPricePerLiter).toBeCloseTo(124 / 70);
    expect(m.l100).toBeCloseTo(7);
    expect(m.kmPerL).toBeCloseTo(1000 / 70);
    expect(m.fuelCostPer100Km).toBeCloseTo(12.4);
  });

  it('never averages per-fill-up prices', () => {
    const [m] = monthlyStats({
      fillups: [fill('2026-03-01', 100, 10, 10), fill('2026-03-02', 100, 90, 180)],
      expenses: [],
    });
    // Per-fill average would be (1 + 2) / 2 = 1.5 €/L; totals give 190 / 100 = 1.9.
    expect(m!.avgPricePerLiter).toBeCloseTo(1.9);
  });

  it('uses only valid segments for L/100 km but all fills for km and cost', () => {
    const [m] = monthlyStats({
      fillups: [
        fill('2026-03-01', 500, 30, 50),
        fill('2026-03-10', 400, 20, 34, { missedPrevious: true }),
        fill('2026-03-20', 200, 10, 17, { fullTank: false }),
      ],
      expenses: [],
    });
    expect(m!.km).toBe(1100);
    expect(m!.liters).toBe(60);
    expect(m!.fuelCost).toBe(101);
    expect(m!.economyKm).toBe(500);
    expect(m!.l100).toBeCloseTo(6);
  });

  it('attributes a segment to the month of its closing fill-up', () => {
    const rows = monthlyStats({
      fillups: [
        fill('2026-03-28', 300, 15, 25, { fullTank: false }),
        fill('2026-04-03', 300, 21, 35),
      ],
      expenses: [],
    });
    expect(monthOf(rows, '2026-03').l100).toBeNull();
    expect(monthOf(rows, '2026-03').km).toBe(300);
    expect(monthOf(rows, '2026-04').l100).toBeCloseTo(6);
  });

  it('adds expenses by category and total cost of ownership', () => {
    const [m] = monthlyStats({
      fillups: [fill('2026-05-01', 1000, 60, 100)],
      expenses: [
        exp('2026-05-02', 'service', 150),
        exp('2026-05-03', 'tolls', 10),
        exp('2026-05-04', 'tolls', 5),
      ],
    });
    expect(m!.expensesByCategory.service).toBe(150);
    expect(m!.expensesByCategory.tolls).toBe(15);
    expect(m!.expensesByCategory.insurance).toBe(0);
    expect(m!.expensesTotal).toBe(165);
    expect(m!.totalCost).toBe(265);
    expect(m!.trueCostPerKm).toBeCloseTo(0.265);
  });

  it('fills months with no fill-ups as empty rows', () => {
    const rows = monthlyStats({
      fillups: [fill('2026-01-15', 500, 30, 50), fill('2026-04-15', 500, 30, 50)],
      expenses: [exp('2026-02-10', 'insurance', 300)],
    });
    expect(rows.map((r) => r.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    const feb = rows[1]!;
    expect(feb.fillupCount).toBe(0);
    expect(feb.km).toBe(0);
    expect(feb.avgPricePerLiter).toBeNull();
    expect(feb.l100).toBeNull();
    expect(feb.trueCostPerKm).toBeNull();
    expect(feb.totalCost).toBe(300);
    expect(rows[2]!.totalCost).toBe(0);
  });

  it('spans the boundary between years', () => {
    const rows = monthlyStats({
      fillups: [fill('2025-12-20', 500, 30, 50), fill('2026-01-05', 500, 30, 52)],
      expenses: [],
    });
    expect(rows.map((r) => r.month)).toEqual(['2025-12', '2026-01']);
  });

  it('respects explicit from/to ranges', () => {
    const rows = monthlyStats(
      { fillups: [fill('2026-02-15', 500, 30, 50)], expenses: [] },
      { from: '2026-01', to: '2026-03' },
    );
    expect(rows.map((r) => r.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('ignores soft-deleted records', () => {
    const [m] = monthlyStats({
      fillups: [fill('2026-03-01', 500, 30, 50), deleted(fill('2026-03-05', 500, 30, 50))],
      expenses: [deleted(exp('2026-03-02', 'wash', 10))],
    });
    expect(m!.fillupCount).toBe(1);
    expect(m!.expensesTotal).toBe(0);
  });

  it('adds up several cars for the household view', () => {
    const [m] = monthlyStats({
      fillups: [
        fill('2026-03-01', 500, 30, 50),
        fill('2026-03-02', 800, 64, 100, { carId: CAR2_ID }),
      ],
      expenses: [],
    });
    expect(m!.km).toBe(1300);
    expect(m!.l100).toBeCloseTo((94 / 1300) * 100);
  });
});

describe('combineStats / monthOf', () => {
  it('combines months by summing totals', () => {
    const rows = monthlyStats({
      fillups: [fill('2026-01-01', 1000, 50, 80), fill('2026-02-01', 1000, 70, 120)],
      expenses: [],
    });
    const c = combineStats(rows);
    expect(c.km).toBe(2000);
    expect(c.l100).toBeCloseTo(6);
    expect(c.avgPricePerLiter).toBeCloseTo(200 / 120);
  });
  it('returns an empty month for missing data', () => {
    const m = monthOf([], '2026-07');
    expect(m.month).toBe('2026-07');
    expect(m.totalCost).toBe(0);
    expect(m.l100).toBeNull();
  });
});

describe('expenseGroupTotals', () => {
  it('folds categories into chart groups', async () => {
    const { expenseGroupTotals, EXPENSE_GROUPS } = await import('../src');
    const [m] = monthlyStats({
      fillups: [],
      expenses: [
        exp('2026-01-01', 'service', 100),
        exp('2026-01-02', 'tires', 50),
        exp('2026-01-03', 'kteo', 55),
        exp('2026-01-04', 'wash', 10),
      ],
    });
    expect(expenseGroupTotals(m!.expensesByCategory)).toEqual({
      maintenance: 150,
      fees: 55,
      driving: 10,
      other: 0,
    });
    expect(EXPENSE_GROUPS.flatMap((g) => g.categories)).toHaveLength(10);
  });
});
