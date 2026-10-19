import { isoDateSchema } from './schemas';

/**
 * Parse a user-typed number. Accepts `41,2`, `41.2`, `1.234,56`, `1,234.56`, `€ 72,50`.
 * When both separators appear, the last one is the decimal separator.
 * A single separator kind appearing more than once is treated as thousands grouping.
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  let s = input.trim().replace(/[€\s\u00a0]/g, '');
  if (s === '') return null;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    normalized = s.split(thousands).join('').replace(decimal, '.');
    if ((normalized.match(/\./g) ?? []).length > 1) return null;
  } else {
    const sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
    if (sep == null) normalized = s;
    else {
      const count = s.split(sep).length - 1;
      if (count === 1) normalized = s.replace(sep, '.');
      else {
        // 1.234.567 → grouping. Every group after the first must be 3 digits.
        const groups = s.split(sep);
        if (groups.slice(1).some((g) => g.length !== 3)) return null;
        normalized = groups.join('');
      }
    }
  }
  if (normalized.startsWith('.')) normalized = '0' + normalized;
  if (normalized.endsWith('.')) normalized = normalized.slice(0, -1);
  const n = Number(normalized);
  return Number.isFinite(n) ? sign * n : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Parse common date formats into `YYYY-MM-DD`.
 * Year-first: 2026-09-03, 2026/9/3, 2026.09.03. Day-first (Greek order): 03/09/2026, 3-9-26, 03.09.2026.
 */
export function parseFlexibleDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (match) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
    if (!match) return null;
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (y < 100) y += 2000;
  }
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isoDateSchema.safeParse(iso).success ? iso : null;
}

export interface PasteRowValue {
  date: string;
  tripKm: number;
  liters: number;
  totalCost: number;
  station: string | null;
}

export interface PasteRow {
  line: number;
  raw: string;
  value: PasteRowValue | null;
  errors: string[];
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  if (/,\s/.test(line)) return line.split(/,\s+/);
  return line.split(',');
}

/**
 * Parse pasted past fill-ups: `date, trip km, liters, cost[, station]` per line.
 * Values may be separated by tabs, semicolons, `, ` or `,`. A header line is skipped.
 */
export function parsePasteImport(text: string): PasteRow[] {
  const rows: PasteRow[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const raw = rawLine.trim();
    if (raw === '' || raw.startsWith('#')) return;
    const fields = splitLine(raw).map((f) => f.trim());
    const errors: string[] = [];

    if (rows.length === 0 && parseFlexibleDate(fields[0] ?? '') == null && /[a-z]/i.test(raw)) {
      return; // header row
    }
    if (fields.length < 4) {
      errors.push('Needs 4 values: date, trip km, liters, cost');
      rows.push({ line: i + 1, raw, value: null, errors });
      return;
    }
    if (fields.length > 5 && fields.slice(4).every((f) => /^\d+$/.test(f))) {
      errors.push('Ambiguous commas. Use dots for decimals, or separate values with tabs or ";"');
      rows.push({ line: i + 1, raw, value: null, errors });
      return;
    }
    const [dateStr, kmStr, litersStr, costStr, stationStr] = fields as [
      string,
      string,
      string,
      string,
      string | undefined,
    ];
    const date = parseFlexibleDate(dateStr);
    const tripKm = parseDecimal(kmStr);
    const liters = parseDecimal(litersStr);
    const totalCost = parseDecimal(costStr);
    if (date == null) errors.push(`Unrecognised date "${dateStr}"`);
    if (tripKm == null || tripKm < 0) errors.push(`Invalid trip km "${kmStr}"`);
    if (liters == null || liters <= 0) errors.push(`Invalid liters "${litersStr}"`);
    if (totalCost == null || totalCost < 0) errors.push(`Invalid cost "${costStr}"`);
    const station = stationStr && stationStr !== '' ? stationStr : null;
    rows.push({
      line: i + 1,
      raw,
      value:
        errors.length === 0
          ? { date: date!, tripKm: tripKm!, liters: liters!, totalCost: totalCost!, station }
          : null,
      errors,
    });
  });
  return rows;
}
