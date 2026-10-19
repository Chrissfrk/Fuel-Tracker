import { describe, expect, it } from 'vitest';
import { averageKmPerDay, estimatedOdometer, latestOdometerReading } from '../src';
import { CAR2_ID, car, deleted, exp, fill, reading } from './fixtures';

const c = car({ startOdometerKm: 80000, startDate: '2026-01-01' });

describe('latestOdometerReading', () => {
  it('starts from the car start odometer', () => {
    expect(latestOdometerReading(c, [], [])).toMatchObject({ km: 80000, source: 'start' });
  });
  it('picks the most recent manual reading or expense odometer', () => {
    const base = latestOdometerReading(
      c,
      [reading('2026-02-01', 81000), reading('2026-03-01', 82000)],
      [exp('2026-02-15', 'service', 100, { odometerKm: 81500 })],
    );
    expect(base).toMatchObject({ km: 82000, source: 'manual', date: '2026-03-01' });
    const base2 = latestOdometerReading(
      c,
      [reading('2026-02-01', 81000)],
      [exp('2026-02-15', 'service', 100, { odometerKm: 81500 })],
    );
    expect(base2).toMatchObject({ km: 81500, source: 'expense' });
  });
  it('ignores expenses without odometer, other cars and deleted readings', () => {
    const base = latestOdometerReading(
      c,
      [deleted(reading('2026-05-01', 90000)), reading('2026-05-01', 95000, { carId: CAR2_ID })],
      [exp('2026-04-01', 'wash', 10)],
    );
    expect(base.source).toBe('start');
  });
});

describe('estimatedOdometer', () => {
  it('adds trip km of fill-ups after the start (including the start date)', () => {
    const e = estimatedOdometer(
      c,
      [fill('2026-01-01', 400, 30, 50), fill('2026-01-20', 600, 40, 66)],
      [],
      [],
    );
    expect(e.km).toBe(81000);
    expect(e.addedKm).toBe(1000);
  });

  it('only adds fill-ups after the latest real reading', () => {
    const fills = [fill('2026-01-10', 500, 30, 50), fill('2026-02-10', 600, 40, 66)];
    const r = reading('2026-02-01', 84230);
    const fillsAfter = [...fills, fill('2026-02-20', 300, 20, 34)];
    expect(estimatedOdometer(c, fills, [r], []).km).toBe(84230 + 600);
    expect(estimatedOdometer(c, fillsAfter, [r], []).km).toBe(84230 + 900);
  });

  it('uses creation order on the same day as the reading', () => {
    const before = fill('2026-02-01', 500, 30, 50);
    const r = reading('2026-02-01', 85000);
    const after = fill('2026-02-01', 100, 10, 17);
    expect(estimatedOdometer(c, [before, after], [r], []).km).toBe(85100);
  });

  it('ignores deleted fill-ups and other cars', () => {
    const e = estimatedOdometer(
      c,
      [
        deleted(fill('2026-01-10', 500, 30, 50)),
        fill('2026-01-10', 700, 30, 50, { carId: CAR2_ID }),
      ],
      [],
      [],
    );
    expect(e.km).toBe(80000);
  });
});

describe('averageKmPerDay', () => {
  it('returns null with no data', () => {
    expect(averageKmPerDay([], '2026-06-01')).toBeNull();
  });
  it('uses the last 90 days when there is enough history', () => {
    const fills = [
      fill('2025-01-01', 9000, 30, 50), // outside window
      fill('2026-04-01', 900, 30, 50),
      fill('2026-05-01', 900, 30, 50),
    ];
    expect(averageKmPerDay(fills, '2026-06-01')).toBeCloseTo(1800 / 90);
  });
  it('uses the whole history when it is short', () => {
    const fills = [fill('2026-05-25', 300, 20, 30), fill('2026-05-28', 300, 20, 30)];
    expect(averageKmPerDay(fills, '2026-06-01')).toBeCloseTo(600 / 7);
  });
  it('ignores future-dated fill-ups', () => {
    expect(averageKmPerDay([fill('2026-07-01', 300, 20, 30)], '2026-06-01')).toBeNull();
  });
});
