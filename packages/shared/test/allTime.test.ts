import { describe, expect, it } from 'vitest';
import { allTimeStats } from '../src';
import { deleted, exp, fill } from './fixtures';

describe('allTimeStats', () => {
  it('is empty with no data', () => {
    const s = allTimeStats({ fillups: [], expenses: [] }, '2026-06-01');
    expect(s.firstDate).toBeNull();
    expect(s.totalCost).toBe(0);
    expect(s.l100).toBeNull();
    expect(s.bestSegment).toBeNull();
    expect(s.cheapestFill).toBeNull();
    expect(s.avgMonthlySpend).toBeNull();
  });

  it('handles a single fill-up', () => {
    const s = allTimeStats(
      { fillups: [fill('2026-06-01', 600, 36, 60)], expenses: [] },
      '2026-06-01',
    );
    expect(s.km).toBe(600);
    expect(s.l100).toBeCloseTo(6);
    expect(s.bestSegment).toBe(s.worstSegment);
    expect(s.monthsCovered).toBe(1);
    expect(s.avgMonthlySpend).toBe(60);
  });

  it('computes totals, extremes and monthly average', () => {
    const s = allTimeStats(
      {
        fillups: [
          fill('2026-01-10', 500, 25, 40, { station: 'A' }), // 5.0, 1.60 €/L
          fill('2026-02-10', 500, 40, 76, { station: 'B' }), // 8.0, 1.90 €/L
          fill('2026-03-10', 500, 30, 54), // 6.0, 1.80 €/L
          fill('2026-03-20', 200, 10, 17, { fullTank: false }), // pending
        ],
        expenses: [exp('2026-02-01', 'service', 200), deleted(exp('2026-02-02', 'repair', 999))],
      },
      '2026-04-15',
    );
    expect(s.km).toBe(1700);
    expect(s.liters).toBe(105);
    expect(s.fuelCost).toBe(187);
    expect(s.expensesTotal).toBe(200);
    expect(s.totalCost).toBe(387);
    expect(s.fillupCount).toBe(4);
    expect(s.l100).toBeCloseTo((95 / 1500) * 100);
    expect(s.bestSegment!.l100).toBeCloseTo(5);
    expect(s.worstSegment!.l100).toBeCloseTo(8);
    expect(s.cheapestFill!.pricePerLiter).toBeCloseTo(1.6);
    expect(s.cheapestFill!.station).toBe('A');
    expect(s.priciestFill!.pricePerLiter).toBeCloseTo(1.9);
    expect(s.firstDate).toBe('2026-01-10');
    expect(s.monthsCovered).toBe(4); // Jan–Apr
    expect(s.avgMonthlySpend).toBeCloseTo(387 / 4);
    expect(s.trueCostPerKm).toBeCloseTo(387 / 1700);
  });

  it('counts months across a year boundary', () => {
    const s = allTimeStats(
      { fillups: [fill('2025-11-10', 500, 30, 50)], expenses: [] },
      '2026-02-01',
    );
    expect(s.monthsCovered).toBe(4);
  });
});
