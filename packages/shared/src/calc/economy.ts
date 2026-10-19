import type { Fillup, FuelType } from '../schemas';
import { alive, groupBy, safeDiv, sortChrono } from './util';

type FillupLike = Pick<
  Fillup,
  | 'id'
  | 'carId'
  | 'date'
  | 'createdAt'
  | 'deletedAt'
  | 'tripKm'
  | 'liters'
  | 'totalCost'
  | 'fullTank'
  | 'missedPrevious'
  | 'fuelType'
  | 'station'
>;

// ---------- Per fill-up ----------

export const pricePerLiter = (f: Pick<Fillup, 'totalCost' | 'liters'>) =>
  safeDiv(f.totalCost, f.liters);
export const costPerKm = (f: Pick<Fillup, 'totalCost' | 'tripKm'>) =>
  safeDiv(f.totalCost, f.tripKm);
export function costPer100Km(f: Pick<Fillup, 'totalCost' | 'tripKm'>) {
  const c = costPerKm(f);
  return c == null ? null : c * 100;
}

// ---------- Full-tank segments ----------

export type SegmentStatus = 'valid' | 'excluded' | 'pending';

export interface Segment {
  carId: string;
  fillupIds: string[];
  startDate: string;
  /** Date of the closing full-tank fill-up (or of the last partial fill when pending). */
  endDate: string;
  closingFillupId: string | null;
  liters: number;
  km: number;
  cost: number;
  status: SegmentStatus;
  excludedReason: 'missed_previous' | 'no_distance' | null;
  /** Only set for valid segments. */
  l100: number | null;
  kmPerL: number | null;
  /** Station and fuel type of the closing fill-up. */
  station: string | null;
  fuelType: FuelType | null;
}

function closeSegment(carId: string, group: FillupLike[], closed: boolean): Segment {
  const first = group[0]!;
  const last = group[group.length - 1]!;
  const liters = group.reduce((s, f) => s + f.liters, 0);
  const km = group.reduce((s, f) => s + f.tripKm, 0);
  const cost = group.reduce((s, f) => s + f.totalCost, 0);
  const missed = group.some((f) => f.missedPrevious);
  let status: SegmentStatus;
  let excludedReason: Segment['excludedReason'] = null;
  if (!closed) status = 'pending';
  else if (missed) {
    status = 'excluded';
    excludedReason = 'missed_previous';
  } else if (km <= 0 || liters <= 0) {
    status = 'excluded';
    excludedReason = 'no_distance';
  } else status = 'valid';
  const valid = status === 'valid';
  return {
    carId,
    fillupIds: group.map((f) => f.id),
    startDate: first.date,
    endDate: last.date,
    closingFillupId: closed ? last.id : null,
    liters,
    km,
    cost,
    status,
    excludedReason,
    l100: valid ? (liters / km) * 100 : null,
    kmPerL: valid ? km / liters : null,
    station: last.station ?? null,
    fuelType: last.fuelType ?? null,
  };
}

/**
 * Split fill-ups into full-tank segments, per car, in chronological order.
 * A segment is every fill-up since the previous full tank, ending at the next full tank.
 */
export function computeSegments(fillups: readonly FillupLike[]): Segment[] {
  const out: Segment[] = [];
  for (const [carId, rows] of groupBy(alive(fillups), (f) => f.carId)) {
    let group: FillupLike[] = [];
    for (const f of sortChrono(rows)) {
      group.push(f);
      if (f.fullTank) {
        out.push(closeSegment(carId, group, true));
        group = [];
      }
    }
    if (group.length > 0) out.push(closeSegment(carId, group, false));
  }
  return out.sort((a, b) => (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0));
}

export const validSegments = (segments: readonly Segment[]) =>
  segments.filter((s) => s.status === 'valid');

export interface EconomyTotals {
  liters: number;
  km: number;
  l100: number | null;
  kmPerL: number | null;
  segmentCount: number;
}

/** Combine valid segments by dividing totals (never averaging ratios). */
export function economyOf(segments: readonly Segment[]): EconomyTotals {
  const valid = validSegments(segments);
  const liters = valid.reduce((s, x) => s + x.liters, 0);
  const km = valid.reduce((s, x) => s + x.km, 0);
  const l100 = safeDiv(liters, km);
  return {
    liters,
    km,
    l100: l100 == null ? null : l100 * 100,
    kmPerL: safeDiv(km, liters),
    segmentCount: valid.length,
  };
}

/** Segment that the given fill-up closes, if any. */
export function segmentClosedBy(segments: readonly Segment[], fillupId: string) {
  return segments.find((s) => s.closingFillupId === fillupId) ?? null;
}

export interface RollingPoint {
  segment: Segment;
  /** Economy over the last `window` valid segments, from their totals. */
  rollingL100: number;
}

/** Rolling L/100 km across valid segments (per car), always total liters ÷ total km. */
export function rollingEconomy(segments: readonly Segment[], window = 5): RollingPoint[] {
  const out: RollingPoint[] = [];
  const byCar = new Map<string, Segment[]>();
  for (const s of validSegments(segments)) {
    const list = byCar.get(s.carId) ?? [];
    list.push(s);
    byCar.set(s.carId, list);
    const recent = list.slice(-window);
    const liters = recent.reduce((a, x) => a + x.liters, 0);
    const km = recent.reduce((a, x) => a + x.km, 0);
    out.push({ segment: s, rollingL100: (liters / km) * 100 });
  }
  return out;
}
