import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useState } from 'react';
import {
  estimatedOdometer,
  formatDate,
  formatKm,
  parseDecimal,
  todayIso,
  type OdometerReading,
} from '@fuel/shared';
import { FieldRow, Section } from '../../components/ui/List';
import { NumberInput, focusNextOnEnter } from '../../components/ui/Controls';
import { useExpenses, useFillups, useOdometerReadings } from '../../data/hooks';
import { newBase, saveRecord, softDelete } from '../../data/mutations';
import { useMe } from '../../app/context';
import { CarRow, DateRow } from './fields';
import type { FormHandle, FormProps } from './types';

export const OdometerForm = forwardRef<FormHandle, FormProps<OdometerReading>>(
  function OdometerForm({ cars, defaultCarId, editing, readOnly, onStatus, onDone }, ref) {
    const me = useMe();
    const id = useId();
    const [carId, setCarId] = useState(editing?.carId ?? defaultCarId);
    const car = cars.find((c) => c.id === carId);
    const carIds = useMemo(() => [carId], [carId]);
    const fillups = useFillups(carIds);
    const expenses = useExpenses(carIds);
    const readings = useOdometerReadings(carIds);
    const [date, setDate] = useState(editing?.date ?? todayIso());
    const [km, setKm] = useState(editing ? String(Math.round(editing.odometerKm)) : '');
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);

    const estimate = useMemo(
      () =>
        car
          ? estimatedOdometer(
              car,
              fillups,
              readings.filter((r) => r.id !== editing?.id),
              expenses,
            )
          : null,
      [car, fillups, readings, expenses, editing?.id],
    );
    const kmN = parseDecimal(km);
    const canSave = !readOnly && kmN != null && kmN >= 0;
    useEffect(() => onStatus({ canSave, label: 'Save' }), [canSave, onStatus]);

    useImperativeHandle(ref, () => ({
      isDirty: () => dirty,
      async submit() {
        if (kmN == null || kmN < 0) {
          setError('Enter the odometer reading');
          return false;
        }
        const previous = editing;
        const saved = await saveRecord('odometerReadings', {
          ...(editing ?? newBase(me.id)),
          carId,
          date,
          odometerKm: Math.round(kmN),
          source: 'manual',
        });
        onDone({
          message: 'Odometer updated',
          undo: previous
            ? async () => void (await saveRecord('odometerReadings', previous))
            : async () => void (await softDelete('odometerReadings', saved.id)),
        });
        return true;
      },
    }));

    return (
      <form onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => focusNextOnEnter(e)} noValidate>
        <fieldset disabled={readOnly} className="contents">
          <Section>
            <CarRow
              cars={cars}
              value={carId}
              onChange={(v) => (setDirty(true), setCarId(v))}
              disabled={!!editing}
            />
            <DateRow value={date} onChange={(v) => (setDirty(true), setDate(v))} />
          </Section>
          <Section
            footer={
              estimate && (
                <>
                  Estimated now: ≈ {formatKm(estimate.km)}, from{' '}
                  {estimate.base.source === 'start'
                    ? 'the starting odometer'
                    : `a reading on ${formatDate(estimate.base.date)}`}
                  {estimate.addedKm > 0 ? ` plus ${formatKm(estimate.addedKm)} of trips` : ''}.
                  Enter the real reading from the dashboard to correct it.
                </>
              )
            }
          >
            <FieldRow label="Odometer" htmlFor={id} error={error}>
              <NumberInput
                id={id}
                value={km}
                onChange={(v) => (setDirty(true), setKm(v))}
                suffix="km"
                placeholder={estimate ? String(Math.round(estimate.km)) : '0'}
                autoFocus={!editing}
                inputMode="numeric"
                enterKeyHint="done"
              />
            </FieldRow>
          </Section>
        </fieldset>
      </form>
    );
  },
);
