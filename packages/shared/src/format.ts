const LOCALE = 'el-GR';

const currency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' });
const currencyWhole = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const numberCache = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}-${max}`;
  let f = numberCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: true,
    });
    numberCache.set(key, f);
  }
  return f;
}

const DASH = '–';

/** `71,30 €` */
export function formatCurrency(n: number | null | undefined, opts?: { whole?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return (opts?.whole ? currencyWhole : currency).format(n);
}

export function formatNumber(n: number | null | undefined, decimals = 0, minDecimals = decimals) {
  if (n == null || !Number.isFinite(n)) return DASH;
  return nf(minDecimals, decimals).format(n);
}

/** `84.230 km` */
export const formatKm = (n: number | null | undefined) =>
  n == null ? DASH : `${formatNumber(n, 0)} km`;
/** `41,2 L` */
export const formatLiters = (n: number | null | undefined) =>
  n == null ? DASH : `${formatNumber(n, 2, 0)} L`;
/** `1,759 €/L` — three decimals like Greek pump displays. */
export const formatPricePerLiter = (n: number | null | undefined) =>
  n == null ? DASH : `${formatNumber(n, 3, 3)} €/L`;
/** `6,4 L/100 km` */
export const formatL100 = (n: number | null | undefined) =>
  n == null ? DASH : `${formatNumber(n, 1, 1)} L/100 km`;
export const formatKmPerL = (n: number | null | undefined) =>
  n == null ? DASH : `${formatNumber(n, 1, 1)} km/L`;
/** `0,12 €/km` */
export const formatCostPerKm = (n: number | null | undefined) =>
  n == null ? DASH : `${formatNumber(n, 3, 2)} €/km`;
export const formatPct = (n: number | null | undefined, decimals = 0) =>
  n == null ? DASH : `${formatNumber(Math.abs(n) * 100, decimals, decimals)}%`;

/** `2026-09-03` → `03/09/2026` */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `2026-09` → `September 2026` (or `Sep 2026` when short). */
export function formatMonth(monthKey: string, opts?: { short?: boolean; noYear?: boolean }) {
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  const name = MONTHS[m - 1] ?? '';
  const label = opts?.short ? name.slice(0, 3) : name;
  return opts?.noYear ? label : `${label} ${y}`;
}

export const monthName = (month1to12: number, short = false) => {
  const n = MONTHS[month1to12 - 1] ?? '';
  return short ? n.slice(0, 3) : n;
};

/** Number for an input field, using a comma decimal like `41,2`. */
export function toInputNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(Math.round(n * 10 ** decimals) / 10 ** decimals).replace('.', ',');
}
