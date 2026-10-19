import { describe, expect, it } from 'vitest';
import {
  fillupSchema,
  formatCurrency,
  formatDate,
  formatKm,
  formatL100,
  formatLiters,
  formatMonth,
  formatPricePerLiter,
  monthRange,
  parseDecimal,
  parseFlexibleDate,
  parsePasteImport,
  shiftMonth,
  toInputNumber,
} from '../src';
import { fill } from './fixtures';

describe('parseDecimal', () => {
  it.each([
    ['41,2', 41.2],
    ['41.2', 41.2],
    [' 72,50 € ', 72.5],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234.567', 1234567],
    ['612', 612],
    [',5', 0.5],
    ['5,', 5],
    ['-3,5', -3.5],
  ])('parses %s', (input, expected) => {
    expect(parseDecimal(input)).toBeCloseTo(expected);
  });
  it.each(['', 'abc', '1.2.3', '1,2,3', '1.234.56'])('rejects %s', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });
  it('passes numbers through', () => {
    expect(parseDecimal(3)).toBe(3);
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(Number.NaN)).toBeNull();
  });
});

describe('parseFlexibleDate', () => {
  it.each([
    ['2026-09-03', '2026-09-03'],
    ['2026/9/3', '2026-09-03'],
    ['03/09/2026', '2026-09-03'],
    ['3-9-26', '2026-09-03'],
    ['03.09.2026', '2026-09-03'],
    ['2026-09-03T10:00', '2026-09-03'],
  ])('parses %s', (input, expected) => {
    expect(parseFlexibleDate(input)).toBe(expected);
  });
  it.each(['31/02/2026', '2026-13-01', 'yesterday', ''])('rejects %s', (input) => {
    expect(parseFlexibleDate(input)).toBeNull();
  });
});

describe('parsePasteImport', () => {
  it('parses comma-space, tab and semicolon separated lines with either decimal', () => {
    const rows = parsePasteImport(
      [
        '2026-09-03, 612, 41.2, 72.50',
        '04/09/2026\t580\t39,8\t70,10\tShell',
        '2026-09-10;600;40,5;71',
      ].join('\n'),
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
    expect(rows[0]!.value).toEqual({
      date: '2026-09-03',
      tripKm: 612,
      liters: 41.2,
      totalCost: 72.5,
      station: null,
    });
    expect(rows[1]!.value).toMatchObject({ date: '2026-09-04', liters: 39.8, station: 'Shell' });
    expect(rows[2]!.value).toMatchObject({ liters: 40.5, totalCost: 71 });
  });
  it('keeps comma decimals when values are separated by ", "', () => {
    expect(parsePasteImport('2026-09-03, 612, 41,2, 72,50')[0]!.value).toMatchObject({
      liters: 41.2,
      totalCost: 72.5,
    });
  });
  it('accepts plain comma CSV with dot decimals', () => {
    expect(parsePasteImport('2026-09-03,612,41.2,72.50')[0]!.value).toMatchObject({
      tripKm: 612,
      liters: 41.2,
    });
  });
  it('skips a header line, blank lines and comments', () => {
    const rows = parsePasteImport('date,km,liters,cost\n\n# old car\n2026-09-03,612,41.2,72.50\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.line).toBe(4);
  });
  it('reports errors per line', () => {
    const rows = parsePasteImport(
      '2026-13-03, 612, 41.2, 72.50\n2026-09-03, x, 0, 72\n2026-09-03, 612',
    );
    expect(rows[0]!.errors[0]).toContain('date');
    expect(rows[1]!.errors).toHaveLength(2);
    expect(rows[2]!.errors[0]).toContain('4 values');
    expect(rows.every((r) => r.value == null)).toBe(true);
  });
  it('flags ambiguous comma-only lines', () => {
    expect(parsePasteImport('2026-09-03,612,41,2,72,50')[0]!.errors[0]).toContain('Ambiguous');
  });
});

describe('formatting (el-GR)', () => {
  it('formats currency with Greek separators', () => {
    expect(formatCurrency(71.3)).toBe('71,30 €');
    expect(formatCurrency(1690)).toBe('1.690,00 €');
    expect(formatCurrency(1690.4, { whole: true })).toBe('1.690 €');
    expect(formatCurrency(null)).toBe('–');
  });
  it('formats km, liters, prices and economy', () => {
    expect(formatKm(84230)).toBe('84.230 km');
    expect(formatLiters(41.2)).toBe('41,2 L');
    expect(formatPricePerLiter(1.7597)).toBe('1,760 €/L');
    expect(formatL100(6.04)).toBe('6,0 L/100 km');
  });
  it('formats dates and months', () => {
    expect(formatDate('2026-09-03')).toBe('03/09/2026');
    expect(formatMonth('2026-09')).toBe('September 2026');
    expect(formatMonth('2026-09', { short: true, noYear: true })).toBe('Sep');
  });
  it('formats numbers for inputs with a comma', () => {
    expect(toInputNumber(41.2)).toBe('41,2');
    expect(toInputNumber(null)).toBe('');
  });
});

describe('month helpers', () => {
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-06', -12)).toBe('2025-06');
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthRange('2026-02', '2026-01')).toEqual([]);
  });
});

describe('schemas', () => {
  it('accepts a valid fill-up and normalises empty text to null', () => {
    const f = fillupSchema.parse({ ...fill('2026-01-01', 1, 1, 1), station: '  ', note: '' });
    expect(f.station).toBeNull();
    expect(f.note).toBeNull();
  });
  it('rejects impossible dates and negative liters', () => {
    expect(fillupSchema.safeParse({ ...fill('2026-02-30', 1, 1, 1) }).success).toBe(false);
    expect(fillupSchema.safeParse({ ...fill('2026-02-01', 1, -1, 1) }).success).toBe(false);
  });
});

describe('newId', () => {
  it('falls back to getRandomValues when randomUUID is unavailable (plain-HTTP LAN)', async () => {
    const { newId } = await import('../src');
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 200 }, () => newId()));
      expect(ids.size).toBe(200);
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(fillupSchema.shape.id.safeParse(id).success).toBe(true);
      }
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});
