import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useState } from 'react';
import {
  EXPENSE_CATEGORIES,
  expenseWarnings,
  parseDecimal,
  toInputNumber,
  todayIso,
  type Expense,
  type ExpenseCategory,
} from '@fuel/shared';
import { FieldRow, IconTile, Section } from '../../components/ui/List';
import { NumberInput, focusNextOnEnter } from '../../components/ui/Controls';
import { useExpenses } from '../../data/hooks';
import { newBase, saveRecord, savePhoto, softDelete } from '../../data/mutations';
import { useMe } from '../../app/context';
import { haptic } from '../../lib/motion';
import { CATEGORY_META } from '../labels';
import { CarRow, DateRow, NoteRow, PhotoRow, Warnings } from './fields';
import type { FormHandle, FormProps } from './types';

export const ExpenseForm = forwardRef<FormHandle, FormProps<Expense>>(function ExpenseForm(
  { cars, defaultCarId, editing, readOnly, onStatus, onDone, prefill },
  ref,
) {
  const me = useMe();
  const ids = { amount: useId(), odo: useId() };
  const src = editing ?? prefill;
  const [carId, setCarId] = useState(src?.carId ?? defaultCarId);
  const carIds = useMemo(() => [carId], [carId]);
  const expenses = useExpenses(carIds);
  const [date, setDate] = useState(src?.date ?? todayIso());
  const [category, setCategory] = useState<ExpenseCategory | null>(src?.category ?? null);
  const [amount, setAmount] = useState(src?.amount != null ? toInputNumber(src.amount, 2) : '');
  const [odo, setOdo] = useState(src?.odometerKm != null ? String(Math.round(src.odometerKm)) : '');
  const [note, setNote] = useState(src?.note ?? '');
  const [photoId, setPhotoId] = useState(editing?.receiptPhotoId ?? null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const touch =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setDirty(true);
      fn(v);
    };

  const amountN = parseDecimal(amount);
  const odoN = parseDecimal(odo);
  const warnings = useMemo(
    () =>
      category && amountN != null && amountN > 0
        ? expenseWarnings(
            { id: editing?.id, carId, date, category, amount: amountN },
            { expenses, today: todayIso() },
          )
        : [],
    [category, amountN, carId, date, expenses, editing?.id],
  );
  const canSave = !readOnly && category != null && amountN != null && amountN > 0;
  const label = warnings.length > 0 ? 'Save anyway' : 'Save';
  useEffect(() => onStatus({ canSave, label }), [canSave, label, onStatus]);

  useImperativeHandle(ref, () => ({
    isDirty: () => dirty,
    async submit() {
      const errs: Record<string, string> = {};
      if (!category) errs.category = 'Choose a category';
      if (amountN == null || amountN <= 0) errs.amount = 'Enter the amount';
      if (odo.trim() && (odoN == null || odoN < 0))
        errs.odometerKm = 'Enter a valid odometer reading';
      setErrors(errs);
      if (Object.keys(errs).length > 0) return false;
      const receiptPhotoId = photo ? await savePhoto(photo) : photoId;
      const previous = editing;
      const saved = await saveRecord('expenses', {
        ...(editing ?? newBase(me.id)),
        carId,
        date,
        category: category!,
        amount: amountN!,
        odometerKm: odo.trim() ? odoN : null,
        note: note.trim() || null,
        receiptPhotoId,
      });
      onDone({
        message: previous ? 'Expense updated' : 'Expense saved',
        undo: previous
          ? async () => void (await saveRecord('expenses', previous))
          : async () => void (await softDelete('expenses', saved.id)),
      });
      return true;
    },
  }));

  return (
    <form onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => focusNextOnEnter(e)} noValidate>
      <fieldset disabled={readOnly} className="contents">
        <Section>
          <CarRow cars={cars} value={carId} onChange={touch(setCarId)} disabled={!!editing} />
          <DateRow value={date} onChange={touch(setDate)} />
        </Section>

        <section className="mt-6">
          <h2
            className="mb-1.5 px-4 text-footnote tracking-wide text-label-2 uppercase"
            id="cat-label"
          >
            Category
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="cat-label"
            className="grid grid-cols-5 gap-2 rounded-xl bg-surface p-2"
          >
            {EXPENSE_CATEGORIES.map((c) => {
              const m = CATEGORY_META[c];
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    haptic();
                    touch(setCategory)(c);
                  }}
                  className={`pressable flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 ${
                    on
                      ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] ring-2 ring-accent'
                      : ''
                  }`}
                >
                  <IconTile name={m.icon} color={m.color} size={34} />
                  <span
                    className={`w-full truncate text-center text-caption ${on ? 'font-semibold text-accent-text' : 'text-label-2'}`}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.category && (
            <p className="mt-1.5 px-4 text-footnote text-red-text">{errors.category}</p>
          )}
        </section>

        <Section>
          <FieldRow label="Amount" htmlFor={ids.amount} error={errors.amount}>
            <NumberInput
              id={ids.amount}
              value={amount}
              onChange={touch(setAmount)}
              suffix="€"
              placeholder="0,00"
              autoFocus={!editing && !!prefill?.category}
              invalid={!!errors.amount}
            />
          </FieldRow>
          <FieldRow
            label="Odometer"
            htmlFor={ids.odo}
            error={errors.odometerKm}
            hint="Optional. Corrects the estimated odometer."
          >
            <NumberInput
              id={ids.odo}
              value={odo}
              onChange={touch(setOdo)}
              suffix="km"
              placeholder="Optional"
              inputMode="numeric"
              enterKeyHint="done"
            />
          </FieldRow>
        </Section>

        <Warnings warnings={warnings} />

        <Section>
          <NoteRow value={note} onChange={touch(setNote)} />
          <PhotoRow
            existingId={photoId}
            pending={photo}
            disabled={readOnly}
            onPick={touch(setPhoto)}
            onRemove={() => {
              setDirty(true);
              setPhoto(null);
              setPhotoId(null);
            }}
          />
        </Section>
      </fieldset>
    </form>
  );
});
