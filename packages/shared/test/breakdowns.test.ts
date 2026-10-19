import { describe, expect, it } from 'vitest';
import { fuelTypeStats, seasonalEconomy, stationStats, stationSuggestions } from '../src';
import { CAR2_ID, car, deleted, fill } from './fixtures';

describe('seasonalEconomy', () => {
  it('returns 12 calendar months, empty when no data', () => {
    const s = seasonalEconomy([]);
    expect(s).toHaveLength(12);
    expect(s.every((p) => p.l100 == null)).toBe(true);
  });

  it('pools the same calendar month across years from totals', () => {
    const s = seasonalEconomy([
      fill('2025-07-10', 500, 35, 60), // 7.0
      fill('2026-07-10', 500, 40, 70), // 8.0
      fill('2026-01-10', 500, 25, 45), // 5.0
    ]);
    expect(s[6]!.l100).toBeCloseTo((75 / 1000) * 100);
    expect(s[6]!.segmentCount).toBe(2);
    expect(s[0]!.l100).toBeCloseTo(5);
    expect(s[3]!.l100).toBeNull();
  });

  it('skips excluded segments', () => {
    const s = seasonalEconomy([fill('2026-07-10', 500, 35, 60, { missedPrevious: true })]);
    expect(s[6]!.l100).toBeNull();
  });
});

describe('stationStats', () => {
  it('computes average price from totals and counts fill-ups', () => {
    const stats = stationStats([
      fill('2026-01-01', 500, 30, 54, { station: 'Shell' }),
      fill('2026-01-10', 500, 40, 68, { station: 'Shell' }),
      fill('2026-01-20', 600, 30, 51, { station: 'BP' }),
      fill('2026-01-25', 600, 30, 51, { station: null }),
    ]);
    expect(stats.map((s) => s.key)).toEqual(['Shell', 'BP']);
    const shell = stats[0]!;
    expect(shell.fillupCount).toBe(2);
    expect(shell.avgPricePerLiter).toBeCloseTo(122 / 70);
    expect(shell.l100).toBeCloseTo((70 / 1000) * 100);
    expect(stats[1]!.l100).toBeCloseTo(5);
  });

  it('attributes economy to the closing fill-up station', () => {
    const stats = stationStats([
      fill('2026-01-01', 300, 20, 34, { station: 'Shell', fullTank: false }),
      fill('2026-01-05', 300, 16, 27, { station: 'BP' }),
    ]);
    expect(stats.find((s) => s.key === 'Shell')!.l100).toBeNull();
    expect(stats.find((s) => s.key === 'BP')!.l100).toBeCloseTo(6);
  });

  it('ignores deleted fill-ups and trims names', () => {
    const stats = stationStats([
      fill('2026-01-01', 500, 30, 54, { station: '  Shell ' }),
      deleted(fill('2026-01-02', 500, 30, 54, { station: 'Shell' })),
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0]!.key).toBe('Shell');
    expect(stats[0]!.fillupCount).toBe(1);
  });
});

describe('fuelTypeStats', () => {
  it('falls back to the car fuel type', () => {
    const cars = [car(), car({ id: CAR2_ID, fuelType: 'diesel' })];
    const stats = fuelTypeStats(
      [
        fill('2026-01-01', 500, 30, 54),
        fill('2026-01-02', 500, 30, 60, { fuelType: '100' }),
        fill('2026-01-03', 800, 40, 64, { carId: CAR2_ID }),
      ],
      cars,
    );
    const keys = stats.map((s) => s.key).sort();
    expect(keys).toEqual(['100', '95', 'diesel']);
    expect(stats.find((s) => s.key === 'diesel')!.avgPricePerLiter).toBeCloseTo(1.6);
  });
});

describe('stationSuggestions', () => {
  it('orders by use and merges case variants', () => {
    expect(
      stationSuggestions([
        fill('2026-01-01', 1, 1, 1, { station: 'BP' }),
        fill('2026-01-02', 1, 1, 1, { station: 'Shell' }),
        fill('2026-01-03', 1, 1, 1, { station: 'shell' }),
        fill('2026-01-04', 1, 1, 1, { station: '' }),
      ]),
    ).toEqual(['Shell', 'BP']);
  });
});
