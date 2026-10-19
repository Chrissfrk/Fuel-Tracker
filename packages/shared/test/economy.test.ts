import { describe, expect, it } from 'vitest';
import {
  computeSegments,
  costPer100Km,
  costPerKm,
  economyOf,
  pricePerLiter,
  rollingEconomy,
  segmentClosedBy,
  validSegments,
} from '../src';
import { CAR2_ID, deleted, fill } from './fixtures';

describe('per fill-up', () => {
  it('computes price per liter from totals', () => {
    expect(pricePerLiter({ totalCost: 72.5, liters: 41.2 })).toBeCloseTo(1.7597, 4);
  });
  it('returns null instead of dividing by zero', () => {
    expect(pricePerLiter({ totalCost: 10, liters: 0 })).toBeNull();
    expect(costPerKm({ totalCost: 10, tripKm: 0 })).toBeNull();
    expect(costPer100Km({ totalCost: 10, tripKm: 0 })).toBeNull();
  });
  it('computes cost per km and per 100 km', () => {
    expect(costPerKm({ totalCost: 60, tripKm: 600 })).toBeCloseTo(0.1);
    expect(costPer100Km({ totalCost: 60, tripKm: 600 })).toBeCloseTo(10);
  });
});

describe('computeSegments', () => {
  it('returns nothing for no data', () => {
    expect(computeSegments([])).toEqual([]);
    expect(economyOf([])).toEqual({ liters: 0, km: 0, l100: null, kmPerL: null, segmentCount: 0 });
  });

  it('makes one valid segment from a single full fill-up', () => {
    const [s] = computeSegments([fill('2026-01-10', 600, 36, 60)]);
    expect(s!.status).toBe('valid');
    expect(s!.l100).toBeCloseTo(6);
    expect(s!.kmPerL).toBeCloseTo(16.6667, 3);
  });

  it('folds partial fills into the segment closed by the next full tank', () => {
    const rows = [
      fill('2026-01-01', 500, 30, 50),
      fill('2026-01-05', 200, 10, 17, { fullTank: false }),
      fill('2026-01-08', 300, 20, 34, { fullTank: false }),
      fill('2026-01-12', 400, 30, 51),
    ];
    const segs = computeSegments(rows);
    expect(segs).toHaveLength(2);
    expect(segs[1]!.fillupIds).toHaveLength(3);
    expect(segs[1]!.km).toBe(900);
    expect(segs[1]!.liters).toBe(60);
    expect(segs[1]!.l100).toBeCloseTo((60 / 900) * 100);
    expect(segs[1]!.closingFillupId).toBe(rows[3]!.id);
    expect(segs[1]!.startDate).toBe('2026-01-05');
    expect(segs[1]!.endDate).toBe('2026-01-12');
  });

  it('marks trailing partial fills as pending, with no economy figure', () => {
    const segs = computeSegments([
      fill('2026-01-01', 500, 30, 50),
      fill('2026-01-05', 200, 10, 17, { fullTank: false }),
    ]);
    expect(segs[1]!.status).toBe('pending');
    expect(segs[1]!.l100).toBeNull();
    expect(segs[1]!.closingFillupId).toBeNull();
  });

  it('handles only partial fills (everything pending)', () => {
    const segs = computeSegments([
      fill('2026-01-01', 200, 10, 17, { fullTank: false }),
      fill('2026-01-03', 200, 10, 17, { fullTank: false }),
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.status).toBe('pending');
    expect(economyOf(segs).l100).toBeNull();
  });

  it('excludes a whole segment when any fill-up in it has missedPrevious', () => {
    const segs = computeSegments([
      fill('2026-01-01', 500, 30, 50),
      fill('2026-01-05', 200, 10, 17, { fullTank: false, missedPrevious: true }),
      fill('2026-01-10', 300, 25, 42),
      fill('2026-01-20', 500, 30, 50),
    ]);
    expect(segs.map((s) => s.status)).toEqual(['valid', 'excluded', 'valid']);
    expect(segs[1]!.excludedReason).toBe('missed_previous');
    expect(segs[1]!.l100).toBeNull();
    const e = economyOf(segs);
    expect(e.km).toBe(1000);
    expect(e.liters).toBe(60);
    expect(e.l100).toBeCloseTo(6);
    expect(e.segmentCount).toBe(2);
  });

  it('excludes segments with no distance', () => {
    const [s] = computeSegments([fill('2026-01-01', 0, 40, 70)]);
    expect(s!.status).toBe('excluded');
    expect(s!.excludedReason).toBe('no_distance');
  });

  it('sorts by date, then creation order, regardless of input order', () => {
    const a = fill('2026-02-01', 500, 30, 50);
    const b = fill('2026-01-01', 400, 20, 34, { fullTank: false });
    const c = fill('2026-02-01', 100, 10, 17, { fullTank: false });
    const segs = computeSegments([c, a, b]);
    // b (Jan, partial) + a (Feb 1, full, created before c) → one segment; c trails as pending.
    expect(segs[0]!.fillupIds).toEqual([b.id, a.id]);
    expect(segs[1]!.fillupIds).toEqual([c.id]);
  });

  it('builds segments per car, never mixing cars', () => {
    const segs = computeSegments([
      fill('2026-01-01', 500, 30, 50, { fullTank: false }),
      fill('2026-01-02', 600, 40, 66, { carId: CAR2_ID }),
      fill('2026-01-03', 500, 30, 50),
    ]);
    const car1 = segs.filter((s) => s.carId !== CAR2_ID);
    expect(car1).toHaveLength(1);
    expect(car1[0]!.km).toBe(1000);
    expect(segs.find((s) => s.carId === CAR2_ID)!.l100).toBeCloseTo((40 / 600) * 100);
  });

  it('ignores soft-deleted fill-ups', () => {
    const segs = computeSegments([
      fill('2026-01-01', 500, 30, 50),
      deleted(fill('2026-01-05', 500, 30, 50)),
    ]);
    expect(segs).toHaveLength(1);
  });

  it('crosses a year boundary within one segment', () => {
    const segs = computeSegments([
      fill('2025-12-30', 300, 15, 25, { fullTank: false }),
      fill('2026-01-02', 300, 21, 35),
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.startDate).toBe('2025-12-30');
    expect(segs[0]!.endDate).toBe('2026-01-02');
    expect(segs[0]!.l100).toBeCloseTo(6);
  });

  it('carries the closing fill-up station and fuel type', () => {
    const [s] = computeSegments([
      fill('2026-01-01', 500, 30, 50, { fullTank: false, station: 'Shell' }),
      fill('2026-01-03', 500, 30, 50, { station: 'BP', fuelType: '100' }),
    ]);
    expect(s!.station).toBe('BP');
    expect(s!.fuelType).toBe('100');
  });

  it('finds the segment a fill-up closes', () => {
    const rows = [
      fill('2026-01-01', 500, 30, 50),
      fill('2026-01-05', 200, 10, 17, { fullTank: false }),
    ];
    const segs = computeSegments(rows);
    expect(segmentClosedBy(segs, rows[0]!.id)?.status).toBe('valid');
    expect(segmentClosedBy(segs, rows[1]!.id)).toBeNull();
    expect(validSegments(segs)).toHaveLength(1);
  });
});

describe('economyOf', () => {
  it('divides totals rather than averaging per-segment ratios', () => {
    const segs = computeSegments([
      fill('2026-01-01', 100, 10, 17), // 10 L/100
      fill('2026-01-02', 900, 45, 76), // 5 L/100
    ]);
    // Mean of ratios would be 7.5; the correct total-based figure is 55/1000*100 = 5.5.
    expect(economyOf(segs).l100).toBeCloseTo(5.5);
    expect(economyOf(segs).kmPerL).toBeCloseTo(1000 / 55);
  });
});

describe('rollingEconomy', () => {
  it('rolls over the last N valid segments from totals, per car', () => {
    const segs = computeSegments([
      fill('2026-01-01', 100, 10, 17), // 10
      fill('2026-01-02', 900, 45, 76), // 5
      fill('2026-01-03', 500, 30, 50, { missedPrevious: true }), // excluded
      fill('2026-01-04', 500, 30, 50), // 6
      fill('2026-01-05', 500, 40, 60, { carId: CAR2_ID }), // other car: 8
    ]);
    const r = rollingEconomy(segs, 2);
    expect(r.map((p) => Math.round(p.rollingL100 * 100) / 100)).toEqual([10, 5.5, 5.36, 8]);
    expect(rollingEconomy([], 3)).toEqual([]);
  });
});
