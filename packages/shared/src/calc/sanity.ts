import type { Car, Expense, Fillup } from '../schemas';
import { formatLiters, formatL100, formatPricePerLiter, formatKm, formatCurrency } from '../format';
import { computeSegments, economyOf, segmentClosedBy } from './economy';
import { alive, daysBetween, sortChrono } from './util';

export type WarningCode =
  | 'liters_over_tank'
  | 'price_unusual'
  | 'economy_unusual'
  | 'trip_zero'
  | 'trip_too_long'
  | 'date_future'
  | 'date_before_previous'
  | 'duplicate';

export interface SanityWarning {
  code: WarningCode;
  field: string | null;
  message: string;
}

const DRAFT_ID = '__draft__';

export type FillupDraft = Pick<
  Fillup,
  | 'carId'
  | 'date'
  | 'tripKm'
  | 'liters'
  | 'totalCost'
  | 'fullTank'
  | 'missedPrevious'
  | 'fuelType'
  | 'station'
> & { id?: string };

/**
 * Gentle warnings for a fill-up about to be saved. None of these block saving.
 * `fillups` are the car's existing fill-ups; when editing, pass the record's id on the draft.
 */
export function fillupWarnings(
  draft: FillupDraft,
  ctx: {
    car: Pick<Car, 'id' | 'tankSizeLiters'>;
    fillups: readonly Fillup[];
    today: string;
  },
): SanityWarning[] {
  const warnings: SanityWarning[] = [];
  const editingId = draft.id ?? null;
  const others = alive(ctx.fillups).filter((f) => f.carId === ctx.car.id && f.id !== editingId);
  const tank = ctx.car.tankSizeLiters;

  if (draft.liters > tank * 1.05) {
    warnings.push({
      code: 'liters_over_tank',
      field: 'liters',
      message: `This is a lot more than your tank holds (${formatLiters(tank)}). Is ${formatLiters(draft.liters)} correct?`,
    });
  }

  if (draft.liters > 0) {
    const ppl = draft.totalCost / draft.liters;
    const recent = others.filter((f) => {
      const d = daysBetween(f.date, draft.date);
      return d >= 0 && d <= 90;
    });
    const liters = recent.reduce((s, f) => s + f.liters, 0);
    if (liters > 0) {
      const avg = recent.reduce((s, f) => s + f.totalCost, 0) / liters;
      if (Math.abs(ppl - avg) / avg > 0.2) {
        warnings.push({
          code: 'price_unusual',
          field: 'totalCost',
          message: `That works out to ${formatPricePerLiter(ppl)}, quite different from your recent average of ${formatPricePerLiter(avg)}. Are the liters and cost right?`,
        });
      }
    }
  }

  if (draft.fullTank && draft.liters > 0) {
    const draftRow: Fillup = {
      ...draft,
      id: editingId ?? DRAFT_ID,
      createdAt: Number.MAX_SAFE_INTEGER,
      updatedAt: 0,
      deletedAt: null,
      createdBy: '',
      note: null,
      receiptPhotoId: null,
    };
    const existing = editingId ? ctx.fillups.find((f) => f.id === editingId) : undefined;
    if (existing) draftRow.createdAt = existing.createdAt;
    const segments = computeSegments([...others, draftRow]);
    const seg = segmentClosedBy(segments, draftRow.id);
    const baseline = economyOf(segments.filter((s) => s !== seg));
    if (seg?.l100 != null && baseline.l100 != null) {
      if (Math.abs(seg.l100 - baseline.l100) / baseline.l100 > 0.4) {
        warnings.push({
          code: 'economy_unusual',
          field: 'tripKm',
          message: `This tank comes out at ${formatL100(seg.l100)}, far from your usual ${formatL100(baseline.l100)}. Check the trip km and liters, or turn on "Missed a previous fill-up".`,
        });
      }
    }
  }

  if (draft.tripKm === 0) {
    warnings.push({
      code: 'trip_zero',
      field: 'tripKm',
      message: 'Trip km is 0. Did you forget to read the trip counter?',
    });
  } else if (draft.tripKm > tank * 30) {
    warnings.push({
      code: 'trip_too_long',
      field: 'tripKm',
      message: `${formatKm(draft.tripKm)} is a very long way on one ${formatLiters(tank)} tank. Is the trip km correct?`,
    });
  }

  if (draft.date > ctx.today) {
    warnings.push({ code: 'date_future', field: 'date', message: 'This date is in the future.' });
  } else if (!editingId) {
    const latest = sortChrono(others).at(-1);
    if (latest && draft.date < latest.date) {
      warnings.push({
        code: 'date_before_previous',
        field: 'date',
        message: 'This is earlier than the last fill-up for this car. Is the date right?',
      });
    }
  }

  const dup = others.some(
    (f) =>
      f.date === draft.date &&
      f.liters === draft.liters &&
      f.totalCost === draft.totalCost &&
      f.tripKm === draft.tripKm,
  );
  if (dup) {
    warnings.push({
      code: 'duplicate',
      field: null,
      message: 'An identical fill-up is already logged for this day.',
    });
  }
  return warnings;
}

export type ExpenseDraft = Pick<Expense, 'carId' | 'date' | 'category' | 'amount'> & {
  id?: string;
};

export function expenseWarnings(
  draft: ExpenseDraft,
  ctx: { expenses: readonly Expense[]; today: string },
): SanityWarning[] {
  const warnings: SanityWarning[] = [];
  if (draft.date > ctx.today) {
    warnings.push({ code: 'date_future', field: 'date', message: 'This date is in the future.' });
  }
  const dup = alive(ctx.expenses).some(
    (e) =>
      e.id !== draft.id &&
      e.carId === draft.carId &&
      e.date === draft.date &&
      e.category === draft.category &&
      e.amount === draft.amount,
  );
  if (dup) {
    warnings.push({
      code: 'duplicate',
      field: null,
      message: `An identical ${formatCurrency(draft.amount)} expense is already logged for this day.`,
    });
  }
  return warnings;
}
