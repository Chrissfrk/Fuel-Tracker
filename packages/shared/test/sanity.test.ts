import { describe, expect, it } from 'vitest';
import { expenseWarnings, fillupWarnings, type FillupDraft } from '../src';
import { CAR2_ID, car, deleted, exp, fill } from './fixtures';

const c = car({ tankSizeLiters: 45 });
const today = '2026-06-15';
const draft = (over: Partial<FillupDraft> = {}): FillupDraft => ({
  carId: c.id,
  date: '2026-06-14',
  tripKm: 600,
  liters: 36,
  totalCost: 63,
  fullTank: true,
  missedPrevious: false,
  fuelType: null,
  station: null,
  ...over,
});
// History: ~6 L/100 km at 1.75 €/L.
const history = [
  fill('2026-05-01', 600, 36, 63),
  fill('2026-05-15', 600, 36, 63),
  fill('2026-06-01', 600, 36, 63),
];
const codes = (d: FillupDraft, fillups = history) =>
  fillupWarnings(d, { car: c, fillups, today }).map((w) => w.code);

describe('fillupWarnings', () => {
  it('has no warnings for a normal fill-up', () => {
    expect(codes(draft())).toEqual([]);
  });

  it('has no warnings for the first fill-up of a car', () => {
    expect(codes(draft(), [])).toEqual([]);
  });

  it('warns when liters exceed the tank by more than 5 %', () => {
    expect(codes(draft({ liters: 47.25, totalCost: 82.69, tripKm: 787 }))).toEqual([]);
    const w = fillupWarnings(draft({ liters: 412, totalCost: 721 }), {
      car: c,
      fillups: history,
      today,
    });
    expect(w.map((x) => x.code)).toContain('liters_over_tank');
    expect(w.find((x) => x.code === 'liters_over_tank')!.message).toContain('412 L');
  });

  it('warns when the price is more than 20 % from the 90-day average', () => {
    expect(codes(draft({ totalCost: 36 * 1.75 * 1.19 }))).not.toContain('price_unusual');
    expect(codes(draft({ totalCost: 36 * 1.75 * 1.25 }))).toContain('price_unusual');
    expect(codes(draft({ totalCost: 36 * 1.75 * 0.75 }))).toContain('price_unusual');
  });

  it('ignores fill-ups older than 90 days for the price average', () => {
    const old = [fill('2025-01-01', 600, 36, 30)];
    expect(codes(draft(), old)).not.toContain('price_unusual');
  });

  it('warns when a closing full tank has unusual economy (> 40 % off)', () => {
    expect(codes(draft({ tripKm: 300 }))).toContain('economy_unusual'); // 12 L/100
    expect(codes(draft({ tripKm: 450 }))).not.toContain('economy_unusual'); // 8 L/100 (+33 %)
  });

  it('does not check economy for partial fills or missedPrevious', () => {
    expect(codes(draft({ tripKm: 300, fullTank: false }))).not.toContain('economy_unusual');
    expect(codes(draft({ tripKm: 300, missedPrevious: true }))).not.toContain('economy_unusual');
  });

  it('warns on zero trip km and on implausibly long trips', () => {
    expect(codes(draft({ tripKm: 0 }))).toContain('trip_zero');
    expect(codes(draft({ tripKm: 45 * 30 + 1, liters: 40, totalCost: 70 }))).toContain(
      'trip_too_long',
    );
  });

  it('warns on future dates and dates before the previous fill-up', () => {
    expect(codes(draft({ date: '2026-06-16' }))).toContain('date_future');
    expect(codes(draft({ date: '2026-05-20' }))).toContain('date_before_previous');
  });

  it('skips the earlier-date check when editing an existing record', () => {
    const existing = history[1]!;
    expect(codes(draft({ id: existing.id, date: '2026-05-15' }))).not.toContain(
      'date_before_previous',
    );
  });

  it('flags an identical fill-up on the same day, but not the record being edited', () => {
    const d = draft({ date: '2026-06-01' });
    expect(codes({ ...d })).toContain('duplicate');
    expect(codes({ ...d, id: history[2]!.id })).not.toContain('duplicate');
  });

  it('ignores deleted fill-ups and other cars', () => {
    const fills = [
      deleted(fill('2026-06-14', 600, 36, 63)),
      fill('2026-06-14', 600, 36, 63, { carId: CAR2_ID }),
    ];
    expect(codes(draft(), fills)).not.toContain('duplicate');
  });
});

describe('expenseWarnings', () => {
  const list = [exp('2026-06-10', 'service', 150)];
  it('warns on future dates', () => {
    expect(
      expenseWarnings(
        { carId: c.id, date: '2026-07-01', category: 'wash', amount: 10 },
        { expenses: list, today },
      ).map((w) => w.code),
    ).toEqual(['date_future']);
  });
  it('warns on duplicates only for the same car, day, category and amount', () => {
    const w = (over = {}) =>
      expenseWarnings(
        { carId: c.id, date: '2026-06-10', category: 'service' as const, amount: 150, ...over },
        { expenses: list, today },
      ).map((x) => x.code);
    expect(w()).toEqual(['duplicate']);
    expect(w({ amount: 151 })).toEqual([]);
    expect(w({ carId: CAR2_ID })).toEqual([]);
    expect(w({ id: list[0]!.id })).toEqual([]);
  });
});
