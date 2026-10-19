import { describe, expect, it } from 'vitest';
import { budgetProgress, monthlyStats, projectMonthSpend, projectYearSpend } from '../src';
import { exp, fill } from './fixtures';

describe('projectMonthSpend', () => {
  it('extrapolates fuel at the current pace and adds other expenses as-is', () => {
    const rows = monthlyStats({
      fillups: [fill('2026-06-03', 500, 30, 50), fill('2026-06-09', 500, 30, 50)],
      expenses: [exp('2026-06-05', 'insurance', 300)],
    });
    const p = projectMonthSpend(rows, '2026-06', '2026-06-10');
    expect(p.method).toBe('pace');
    expect(p.soFar).toBe(400);
    expect(p.projected).toBeCloseTo((100 / 10) * 30 + 300);
    expect(p.daysInMonth).toBe(30);
  });

  it('uses the 3-month average while fewer than 7 days have passed', () => {
    const rows = monthlyStats({
      fillups: [
        fill('2026-03-10', 500, 30, 90),
        fill('2026-04-10', 500, 30, 120),
        fill('2026-05-10', 500, 30, 150),
        fill('2026-06-02', 500, 30, 60),
      ],
      expenses: [],
    });
    const p = projectMonthSpend(rows, '2026-06', '2026-06-03');
    expect(p.method).toBe('average');
    expect(p.projected).toBeCloseTo(120);
  });

  it('never projects less than what is already spent', () => {
    const rows = monthlyStats({
      fillups: [fill('2026-05-10', 500, 30, 50), fill('2026-06-02', 500, 30, 200)],
      expenses: [],
    });
    expect(projectMonthSpend(rows, '2026-06', '2026-06-03').projected).toBe(200);
  });

  it('falls back to pace early in the month with no history', () => {
    const rows = monthlyStats({ fillups: [fill('2026-06-02', 500, 30, 60)], expenses: [] });
    const p = projectMonthSpend(rows, '2026-06', '2026-06-03');
    expect(p.method).toBe('pace');
    expect(p.projected).toBeCloseTo(600);
  });

  it('returns actuals for a past month and zero for a future one', () => {
    const rows = monthlyStats({ fillups: [fill('2026-05-10', 500, 30, 50)], expenses: [] });
    expect(projectMonthSpend(rows, '2026-05', '2026-06-15')).toMatchObject({
      method: 'actual',
      projected: 50,
    });
    expect(projectMonthSpend(rows, '2026-07', '2026-06-15').projected).toBe(0);
  });

  it('handles a month with no data', () => {
    expect(projectMonthSpend([], '2026-06', '2026-06-20').projected).toBe(0);
  });

  it('handles February in a leap year', () => {
    const rows = monthlyStats({ fillups: [fill('2028-02-10', 500, 30, 100)], expenses: [] });
    expect(projectMonthSpend(rows, '2028-02', '2028-02-10').daysInMonth).toBe(29);
  });
});

describe('projectYearSpend', () => {
  it('averages the last 12 complete months', () => {
    const fillups = [];
    for (let m = 1; m <= 12; m++) {
      fillups.push(fill(`2025-${String(m).padStart(2, '0')}-10`, 500, 30, 100));
    }
    fillups.push(fill('2024-12-10', 500, 30, 999)); // older than 12 months
    fillups.push(fill('2026-01-03', 500, 30, 10)); // current month, excluded
    const rows = monthlyStats({ fillups, expenses: [] });
    const p = projectYearSpend(rows, '2026-01-05');
    expect(p.monthsUsed).toBe(12);
    expect(p.projected).toBeCloseTo(1200);
  });

  it('uses what is available', () => {
    const rows = monthlyStats({
      fillups: [fill('2026-04-10', 500, 30, 100), fill('2026-05-10', 500, 30, 200)],
      expenses: [],
    });
    const p = projectYearSpend(rows, '2026-06-15');
    expect(p.monthsUsed).toBe(2);
    expect(p.avgPerMonth).toBe(150);
    expect(p.projected).toBe(1800);
  });

  it('falls back to the current month projection with no history', () => {
    const rows = monthlyStats({ fillups: [fill('2026-06-10', 500, 30, 100)], expenses: [] });
    const p = projectYearSpend(rows, '2026-06-10');
    expect(p.monthsUsed).toBe(0);
    expect(p.projected).toBeCloseTo(300 * 12);
  });

  it('is zero with no data', () => {
    expect(projectYearSpend([], '2026-06-10').projected).toBe(0);
  });
});

describe('budgetProgress', () => {
  it('is ok below 80 %', () => {
    expect(budgetProgress(79, 100)).toMatchObject({ status: 'ok', remaining: 21 });
  });
  it('warns from 80 % to 100 %', () => {
    expect(budgetProgress(80, 100).status).toBe('warning');
    expect(budgetProgress(100, 100).status).toBe('warning');
  });
  it('is over above 100 %', () => {
    const b = budgetProgress(120, 100);
    expect(b.status).toBe('over');
    expect(b.ratio).toBeCloseTo(1.2);
    expect(b.remaining).toBe(-20);
  });
  it('handles a zero budget', () => {
    expect(budgetProgress(0, 0).ratio).toBe(0);
  });
});
