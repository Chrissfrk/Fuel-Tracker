import { describe, expect, it } from 'vitest';
import { compareAllMetrics, compareMonth, delta, monthlyStats, threeMonthBaseline } from '../src';
import { fill } from './fixtures';

const rows = monthlyStats({
  fillups: [
    fill('2025-06-10', 1000, 70, 120), // same month last year
    fill('2026-03-10', 1000, 60, 100),
    fill('2026-04-10', 1000, 50, 90),
    fill('2026-05-10', 1000, 70, 110),
    fill('2026-06-10', 1000, 60, 99),
  ],
  expenses: [],
});

describe('delta', () => {
  it('reports diff, pct and direction', () => {
    const d = delta('fuelCost', 110, 100);
    expect(d.diff).toBeCloseTo(10);
    expect(d.pct).toBeCloseTo(0.1);
    expect(d.direction).toBe('up');
    expect(d.good).toBe(false); // cost going up is bad
  });
  it('treats km/L going up as good and L/100 km going up as bad', () => {
    expect(delta('kmPerL', 15, 14).good).toBe(true);
    expect(delta('l100', 7, 6).good).toBe(false);
    expect(delta('l100', 5, 6).good).toBe(true);
  });
  it('is neutral for km driven', () => {
    expect(delta('km', 1200, 1000).good).toBeNull();
  });
  it('handles flat values and missing bases', () => {
    expect(delta('fuelCost', 100, 100).direction).toBe('flat');
    expect(delta('fuelCost', 100, 100).good).toBeNull();
    expect(delta('fuelCost', 100, null)).toMatchObject({ diff: null, pct: null, direction: null });
    expect(delta('fuelCost', 100, 0).pct).toBeNull();
  });
});

describe('compareMonth', () => {
  it('compares against last month', () => {
    const c = compareMonth(rows, '2026-06', 'fuelCost');
    expect(c.value).toBe(99);
    expect(c.vsLastMonth.base).toBe(110);
    expect(c.vsLastMonth.diff).toBeCloseTo(-11);
    expect(c.vsLastMonth.good).toBe(true);
  });

  it('compares against the same month last year', () => {
    const c = compareMonth(rows, '2026-06', 'fuelCost');
    expect(c.vsLastYear.base).toBe(120);
    expect(c.vsLastYear.pct).toBeCloseTo(-21 / 120);
  });

  it('compares additive metrics against the 3-month average', () => {
    const c = compareMonth(rows, '2026-06', 'fuelCost');
    expect(c.vs3MonthAvg.base).toBeCloseTo((100 + 90 + 110) / 3);
  });

  it('recomputes ratio metrics from 3-month totals', () => {
    const base = threeMonthBaseline(
      new Map(rows.map((r) => [r.month, r])),
      '2026-06',
      'avgPricePerLiter',
    );
    expect(base).toBeCloseTo(300 / 180);
    const l100 = compareMonth(rows, '2026-06', 'l100');
    expect(l100.vs3MonthAvg.base).toBeCloseTo((180 / 3000) * 100);
  });

  it('uses only the months that exist for the 3-month baseline', () => {
    const c = compareMonth(rows, '2026-04', 'fuelCost');
    // Data starts 2025-06 so Jan–Mar 2026 all exist (Jan/Feb empty).
    expect(c.vs3MonthAvg.base).toBeCloseTo(100 / 3);
    const first = compareMonth(rows, '2025-06', 'fuelCost');
    expect(first.vsLastMonth.base).toBeNull();
    expect(first.vs3MonthAvg.base).toBeNull();
  });

  it('handles the year boundary for last month', () => {
    const r = monthlyStats({
      fillups: [fill('2025-12-10', 500, 30, 50), fill('2026-01-10', 500, 30, 55)],
      expenses: [],
    });
    expect(compareMonth(r, '2026-01', 'fuelCost').vsLastMonth.base).toBe(50);
  });

  it('returns null value for a month outside the data', () => {
    expect(compareMonth(rows, '2030-01', 'fuelCost').value).toBeNull();
  });

  it('compares every metric at once', () => {
    const all = compareAllMetrics(rows, '2026-06');
    expect(Object.keys(all)).toContain('trueCostPerKm');
    expect(all.km.value).toBe(1000);
  });
});
