import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useState } from 'react';
import {
  FUEL_TYPES,
  estimatedOdometer,
  fillupWarnings,
  formatKm,
  formatPricePerLiter,
  parseDecimal,
  pricePerLiter,
  stationSuggestions,
  toInputNumber,
  todayIso,
  type Car,
  type Fillup,
  type FuelType,
} from '@fuel/shared';
import { FieldRow, Section } from '../../components/ui/List';
import { NumberInput, Switch, focusNextOnEnter } from '../../components/ui/Controls';
import { useExpenses, useFillups, useOdometerReadings } from '../../data/hooks';
import { newBase, saveRecord, savePhoto, softDelete } from '../../data/mutations';
import { useMe } from '../../app/context';
import { FUEL_LABEL } from '../labels';
import { CarRow, DateRow, NoteRow, PhotoRow, Warnings } from './fields';
import type { FormHandle, FormProps } from './types';

const num = (s: string) => parseDecimal(s);

export const FillupForm = forwardRef<FormHandle, FormProps<Fillup>>(function FillupForm(
  { cars, defaultCarId, editing, readOnly, onStatus, onDone },
  ref,
) {
  const me = useMe();
  const ids = {
    trip: useId(),
    liters: useId(),
    cost: useId(),
    station: useId(),
    fuel: useId(),
    stations: useId(),
  };
  const [carId, setCarId] = useState(editing?.carId ?? defaultCarId);
  const car = cars.find((c) => c.id === carId) as Car;
  const carIds = useMemo(() => [carId], [carId]);
  const fillups = useFillups(carIds);
  const expenses = useExpenses(carIds);
  const readings = useOdometerReadings(carIds);

  const [date, setDate] = useState(editing?.date ?? todayIso());
  const [odoMode, setOdoMode] = useState(false);
  const [trip, setTrip] = useState(editing ? toInputNumber(editing.tripKm, 1) : '');
  const [odo, setOdo] = useState('');
  const [liters, setLiters] = useState(editing ? toInputNumber(editing.liters, 2) : '');
  const [cost, setCost] = useState(editing ? toInputNumber(editing.totalCost, 2) : '');
  const [fullTank, setFullTank] = useState(editing?.fullTank ?? true);
  const [missed, setMissed] = useState(editing?.missedPrevious ?? false);
  const [fuelType, setFuelType] = useState<FuelType>(editing?.fuelType ?? car?.fuelType ?? '95');
  const [station, setStation] = useState(editing?.station ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
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

  const others = useMemo(() => fillups.filter((f) => f.id !== editing?.id), [fillups, editing?.id]);
  const estimate = useMemo(
    () => (car ? estimatedOdometer(car, others, readings, expenses) : null),
    [car, others, readings, expenses],
  );
  const suggestions = useMemo(() => stationSuggestions(fillups), [fillups]);

  const tripKm = odoMode
    ? num(odo) != null && estimate
      ? num(odo)! - estimate.km
      : null
    : num(trip);
  const litersN = num(liters);
  const costN = num(cost);
  const ppl =
    litersN && costN != null ? pricePerLiter({ totalCost: costN, liters: litersN }) : null;

  const warnings = useMemo(() => {
    if (!car || tripKm == null || tripKm < 0 || litersN == null || litersN <= 0 || costN == null)
      return [];
    return fillupWarnings(
      {
        id: editing?.id,
        carId,
        date,
        tripKm,
        liters: litersN,
        totalCost: costN,
        fullTank,
        missedPrevious: missed,
        fuelType,
        station,
      },
      { car, fillups, today: todayIso() },
    );
  }, [
    car,
    carId,
    date,
    tripKm,
    litersN,
    costN,
    fullTank,
    missed,
    fuelType,
    station,
    fillups,
    editing?.id,
  ]);

  const canSave = !readOnly && tripKm != null && litersN != null && costN != null;
  const saveLabel = warnings.length > 0 ? 'Save anyway' : 'Save';
  useEffect(() => onStatus({ canSave, label: saveLabel }), [canSave, saveLabel, onStatus]);

  useImperativeHandle(ref, () => ({
    isDirty: () => dirty,
    async submit() {
      const errs: Record<string, string> = {};
      if (tripKm == null)
        errs.tripKm = odoMode ? 'Enter the odometer reading' : 'Enter the trip km';
      else if (tripKm < 0)
        errs.tripKm = `That's below the estimated odometer (${formatKm(estimate?.km)}). Check the reading.`;
      if (litersN == null || litersN <= 0) errs.liters = 'Enter the liters';
      if (costN == null || costN < 0) errs.totalCost = 'Enter the total cost';
      setErrors(errs);
      if (Object.keys(errs).length > 0) return false;

      const receiptPhotoId = photo ? await savePhoto(photo) : photoId;
      const previous = editing;
      const record: Fillup = {
        ...(editing ?? newBase(me.id)),
        carId,
        date,
        tripKm: Math.round(tripKm! * 10) / 10,
        liters: litersN!,
        totalCost: costN!,
        fullTank,
        missedPrevious: missed,
        fuelType: fuelType === car.fuelType ? null : fuelType,
        station: station.trim() || null,
        note: note.trim() || null,
        receiptPhotoId,
      };
      const saved = await saveRecord('fillups', record);
      onDone({
        message: previous ? 'Fill-up updated' : 'Fill-up saved',
        undo: previous
          ? async () => {
              await saveRecord('fillups', previous);
            }
          : async () => {
              await softDelete('fillups', saved.id);
            },
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
            onChange={touch((id: string) => {
              setCarId(id);
              const c = cars.find((x) => x.id === id);
              if (c) setFuelType(c.fuelType);
            })}
            disabled={!!editing}
          />
          <DateRow value={date} onChange={touch(setDate)} />
        </Section>

        <Section
          footer={
            odoMode && estimate ? (
              <>
                Estimated now: ≈ {formatKm(estimate.km)}. Trip:{' '}
                {tripKm != null && tripKm >= 0 ? formatKm(tripKm) : '–'}
              </>
            ) : !editing && estimate ? (
              <button type="button" className="text-accent-text" onClick={() => setOdoMode(true)}>
                Don't have the trip km? Enter the odometer instead
              </button>
            ) : null
          }
        >
          {odoMode ? (
            <FieldRow label="Odometer" htmlFor={ids.trip} error={errors.tripKm}>
              <NumberInput
                id={ids.trip}
                value={odo}
                onChange={touch(setOdo)}
                suffix="km"
                placeholder={estimate ? String(Math.round(estimate.km)) : '0'}
                autoFocus
                inputMode="numeric"
                invalid={!!errors.tripKm}
              />
            </FieldRow>
          ) : (
            <FieldRow label="Trip" htmlFor={ids.trip} error={errors.tripKm}>
              <NumberInput
                id={ids.trip}
                value={trip}
                onChange={touch(setTrip)}
                suffix="km"
                placeholder="0"
                autoFocus={!editing}
                invalid={!!errors.tripKm}
              />
            </FieldRow>
          )}
          <FieldRow label="Liters" htmlFor={ids.liters} error={errors.liters}>
            <NumberInput
              id={ids.liters}
              value={liters}
              onChange={touch(setLiters)}
              suffix="L"
              placeholder="0,00"
              invalid={!!errors.liters}
            />
          </FieldRow>
          <FieldRow label="Total cost" htmlFor={ids.cost} error={errors.totalCost}>
            <NumberInput
              id={ids.cost}
              value={cost}
              onChange={touch(setCost)}
              suffix="€"
              placeholder="0,00"
              enterKeyHint="done"
              invalid={!!errors.totalCost}
            />
          </FieldRow>
          <FieldRow label="Price per liter">
            <output className="text-body text-label-2 tabular" aria-live="polite">
              {ppl != null ? formatPricePerLiter(ppl) : '–'}
            </output>
          </FieldRow>
        </Section>

        <Warnings warnings={warnings} />

        <Section footer="Turn off for a partial fill. Economy is only calculated between full tanks.">
          <FieldRow label="Full tank">
            <Switch checked={fullTank} onChange={touch(setFullTank)} label="Full tank" />
          </FieldRow>
          <FieldRow label="Missed a previous fill-up">
            <Switch
              checked={missed}
              onChange={touch(setMissed)}
              label="Missed a previous fill-up"
            />
          </FieldRow>
        </Section>

        <Section>
          <FieldRow label="Fuel" htmlFor={ids.fuel}>
            <select
              id={ids.fuel}
              value={fuelType}
              onChange={(e) => touch(setFuelType)(e.target.value as FuelType)}
              className="field-input appearance-none bg-transparent text-label-2"
              style={{ textAlignLast: 'right' }}
            >
              {FUEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FUEL_LABEL[t]}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Station" htmlFor={ids.station}>
            <input
              id={ids.station}
              list={ids.stations}
              value={station}
              onChange={(e) => touch(setStation)(e.target.value)}
              placeholder="e.g. Shell Kifisias"
              autoComplete="off"
              enterKeyHint="done"
              className="field-input"
              maxLength={80}
            />
            <datalist id={ids.stations}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </FieldRow>
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
