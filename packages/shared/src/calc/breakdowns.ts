import type { Car, Fillup, FuelType } from '../schemas';
import { computeSegments, economyOf, type Segment } from './economy';
import { alive, groupBy, safeDiv } from './util';

type FillupInput = Parameters<typeof computeSegments>[0][number];

export interface SeasonalPoint {
  /** Calendar month 1–12. */
  month: number;
  l100: number | null;
  liters: number;
  km: number;
  segmentCount: number;
}

/** Average L/100 km per calendar month across all years (valid segments, by closing date). */
export function seasonalEconomy(
  fillups: readonly FillupInput[],
  segments: readonly Segment[] = computeSegments(fillups),
): SeasonalPoint[] {
  const byMonth = groupBy(segments, (s) => Number(s.endDate.slice(5, 7)));
  return Array.from({ length: 12 }, (_, i) => {
    const e = economyOf(byMonth.get(i + 1) ?? []);
    return { month: i + 1, l100: e.l100, liters: e.liters, km: e.km, segmentCount: e.segmentCount };
  });
}

export interface GroupStats {
  key: string;
  fillupCount: number;
  liters: number;
  cost: number;
  avgPricePerLiter: number | null;
  /** From valid segments whose closing fill-up belongs to this group. */
  l100: number | null;
  segmentCount: number;
}

function groupStats(
  fillups: FillupInput[],
  segments: readonly Segment[],
  keyOfFillup: (f: FillupInput) => string | null,
  keyOfSegment: (s: Segment) => string | null,
): GroupStats[] {
  const segsByKey = groupBy(segments, keyOfSegment);
  const out: GroupStats[] = [];
  for (const [key, rows] of groupBy(fillups, keyOfFillup)) {
    if (key == null) continue;
    const liters = rows.reduce((s, f) => s + f.liters, 0);
    const cost = rows.reduce((s, f) => s + f.totalCost, 0);
    const e = economyOf(segsByKey.get(key) ?? []);
    out.push({
      key,
      fillupCount: rows.length,
      liters,
      cost,
      avgPricePerLiter: safeDiv(cost, liters),
      l100: e.l100,
      segmentCount: e.segmentCount,
    });
  }
  return out.sort((a, b) => b.fillupCount - a.fillupCount || a.key.localeCompare(b.key));
}

const normStation = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/** Per station: average €/L (total cost ÷ total liters), L/100 km, number of fill-ups. */
export function stationStats(fillups: readonly FillupInput[]): GroupStats[] {
  const rows = alive(fillups);
  return groupStats(
    rows,
    computeSegments(rows),
    (f) => normStation(f.station),
    (s) => normStation(s.station),
  );
}

/** Per fuel type. Fill-ups without a fuel type use their car's default. */
export function fuelTypeStats(
  fillups: readonly (FillupInput & Pick<Fillup, 'carId'>)[],
  cars: readonly Pick<Car, 'id' | 'fuelType'>[],
): GroupStats[] {
  const carFuel = new Map(cars.map((c) => [c.id, c.fuelType]));
  const rows = alive(fillups);
  const resolve = (ft: FuelType | null, carId: string) => ft ?? carFuel.get(carId) ?? 'other';
  return groupStats(
    rows,
    computeSegments(rows),
    (f) => resolve(f.fuelType, f.carId),
    (s) => resolve(s.fuelType, s.carId),
  );
}

/** Distinct station names, most used first (for autocomplete). */
export function stationSuggestions(fillups: readonly FillupInput[]): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const f of alive(fillups)) {
    const name = normStation(f.station);
    if (!name) continue;
    const k = name.toLowerCase();
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { name, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((c) => c.name);
}
