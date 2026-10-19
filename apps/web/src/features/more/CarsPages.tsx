import { useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FUEL_TYPES,
  formatKm,
  parseDecimal,
  toInputNumber,
  todayIso,
  type Car,
  type FuelType,
  type PublicUser,
} from '@fuel/shared';
import { BarButton, Page } from '../../components/ui/Page';
import { FieldRow, Row, Section } from '../../components/ui/List';
import { Button, NumberInput, Switch, focusNextOnEnter } from '../../components/ui/Controls';
import { CarDot } from '../../components/ui/CarSwitcher';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { toast } from '../../components/ui/Toast';
import { isAdmin, useMe } from '../../app/context';
import { useCars, useRecord, useUsers } from '../../data/hooks';
import { ValidationError, newBase, saveRecord, softDelete } from '../../data/mutations';
import { api, errorMessage } from '../../data/api';
import { getDb } from '../../data/db';
import { syncNow } from '../../data/sync';
import { CAR_COLORS, carColor } from '../../lib/theme';
import { FUEL_LABEL } from '../labels';

export function CarsPage() {
  const cars = useCars({ includeArchived: true });
  const navigate = useNavigate();
  const active = cars.filter((c) => !c.archived);
  const archived = cars.filter((c) => c.archived);
  const row = (c: Car) => (
    <Row
      key={c.id}
      to={`/more/cars/${c.id}`}
      title={c.name}
      subtitle={[c.make, c.model, c.plate].filter(Boolean).join(' · ') || FUEL_LABEL[c.fuelType]}
      leading={<CarDot color={carColor(c, cars.indexOf(c))} size={14} />}
    />
  );
  return (
    <Page
      title="Cars"
      back={{ label: 'More', to: '/more' }}
      trailing={
        <BarButton onClick={() => navigate('/more/cars/new')} label="Add car">
          <Icon name="plus" size={26} strokeWidth={2.2} />
        </BarButton>
      }
    >
      {cars.length === 0 ? (
        <EmptyState
          icon="car"
          title="No cars yet"
          message="Add the cars your family drives. Everyone in the household can log fill-ups for them."
          action={<Button onClick={() => navigate('/more/cars/new')}>Add a car</Button>}
        />
      ) : (
        <>
          <Section>{active.map(row)}</Section>
          {archived.length > 0 && <Section header="Archived">{archived.map(row)}</Section>}
        </>
      )}
    </Page>
  );
}

function TextRow({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  id,
  error,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id: string;
  error?: string;
  autoCapitalize?: string;
}) {
  return (
    <FieldRow label={label} htmlFor={id} error={error}>
      <input
        id={id}
        className="field-input"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="next"
        data-next-field
        autoCapitalize={autoCapitalize}
      />
    </FieldRow>
  );
}

export function CarEditPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const record = useRecord('cars', isNew ? undefined : id);
  if (!isNew && record === undefined)
    return (
      <Page title="Car" back={{ label: 'Cars', to: '/more/cars' }}>
        {null}
      </Page>
    );
  if (!isNew && !record) {
    return (
      <Page title="Car" back={{ label: 'Cars', to: '/more/cars' }}>
        <EmptyState
          icon="car"
          title="Car not found"
          message="It may have been deleted, or you no longer have access to it."
        />
      </Page>
    );
  }
  return <CarForm key={id} existing={isNew ? null : record!} />;
}

function CarForm({ existing }: { existing: Car | null }) {
  const isNew = existing == null;
  const me = useMe();
  const navigate = useNavigate();
  const cars = useCars({ includeArchived: true });
  const uid = useId();

  const [form, setForm] = useState(() =>
    existing
      ? {
          name: existing.name,
          make: existing.make ?? '',
          model: existing.model ?? '',
          plate: existing.plate ?? '',
          fuelType: existing.fuelType,
          tank: toInputNumber(existing.tankSizeLiters, 1),
          startKm: String(Math.round(existing.startOdometerKm)),
          startDate: existing.startDate,
          color: existing.color ?? (CAR_COLORS[0] as string),
          archived: existing.archived,
        }
      : {
          name: '',
          make: '',
          model: '',
          plate: '',
          fuelType: '95' as FuelType,
          tank: '',
          startKm: '',
          startDate: todayIso(),
          color: CAR_COLORS[cars.length % CAR_COLORS.length] as string,
          archived: false,
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set =
    <K extends keyof typeof form>(k: K) =>
    (v: (typeof form)[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const tank = parseDecimal(form.tank);
    const startKm = parseDecimal(form.startKm);
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Give the car a name';
    if (tank == null || tank <= 0) errs.tankSizeLiters = 'Enter the tank size in liters';
    if (startKm == null || startKm < 0)
      errs.startOdometerKm = 'Enter the odometer when you start tracking';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const car: Car = {
        ...(existing ?? newBase(me.id)),
        name: form.name.trim(),
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        plate: form.plate.trim() || null,
        fuelType: form.fuelType,
        tankSizeLiters: tank!,
        startOdometerKm: startKm!,
        startDate: form.startDate,
        color: form.color,
        archived: form.archived,
      };
      await saveRecord('cars', car);
      toast({ tone: 'success', message: isNew ? `${car.name} added` : 'Car saved' });
      navigate('/more/cars', { replace: true });
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fieldErrors);
      else toast({ tone: 'error', message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const db = getDb();
    const count =
      (await db.fillups.where('carId').equals(existing.id).count()) +
      (await db.expenses.where('carId').equals(existing.id).count());
    if (
      !window.confirm(
        count > 0
          ? `Delete ${existing.name}? Its ${count} records will be hidden too. Consider archiving instead.`
          : `Delete ${existing.name}?`,
      )
    )
      return;
    const undo = await softDelete('cars', existing.id);
    toast({ message: `${existing.name} deleted`, action: { label: 'Undo', run: undo } });
    navigate('/more/cars', { replace: true });
  };

  return (
    <Page
      title={isNew ? 'New car' : form.name || 'Car'}
      back={{ label: 'Cars', to: '/more/cars' }}
      trailing={
        <BarButton onClick={() => void save()} disabled={saving} bold>
          Save
        </BarButton>
      }
    >
      <form
        onSubmit={(e) => (e.preventDefault(), void save())}
        onKeyDown={(e) => focusNextOnEnter(e)}
        noValidate
      >
        <Section>
          <TextRow
            id={`${uid}n`}
            label="Name"
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Polo"
            autoFocus={isNew}
            error={errors.name}
          />
          <TextRow
            id={`${uid}m`}
            label="Make"
            value={form.make}
            onChange={set('make')}
            placeholder="Optional"
          />
          <TextRow
            id={`${uid}o`}
            label="Model"
            value={form.model}
            onChange={set('model')}
            placeholder="Optional"
          />
          <TextRow
            id={`${uid}p`}
            label="Plate"
            value={form.plate}
            onChange={set('plate')}
            placeholder="Optional"
            autoCapitalize="characters"
          />
        </Section>
        <Section footer="The odometer and date you start tracking from. Later fill-ups add their trip km to it.">
          <FieldRow label="Fuel" htmlFor={`${uid}f`}>
            <select
              id={`${uid}f`}
              value={form.fuelType}
              onChange={(e) => set('fuelType')(e.target.value as FuelType)}
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
          <FieldRow label="Tank size" htmlFor={`${uid}t`} error={errors.tankSizeLiters}>
            <NumberInput
              id={`${uid}t`}
              value={form.tank}
              onChange={set('tank')}
              suffix="L"
              placeholder="45"
            />
          </FieldRow>
          <FieldRow label="Start odometer" htmlFor={`${uid}k`} error={errors.startOdometerKm}>
            <NumberInput
              id={`${uid}k`}
              value={form.startKm}
              onChange={set('startKm')}
              suffix="km"
              placeholder="0"
              inputMode="numeric"
            />
          </FieldRow>
          <FieldRow label="Start date" htmlFor={`${uid}d`}>
            <input
              id={`${uid}d`}
              type="date"
              value={form.startDate}
              onChange={(e) => e.target.value && set('startDate')(e.target.value)}
              className="field-input bg-transparent text-accent-text"
            />
          </FieldRow>
        </Section>
        <Section header="Colour" footer="Used for this car in the switcher and in every chart.">
          <div role="radiogroup" aria-label="Car colour" className="flex flex-wrap gap-3 p-4">
            {CAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.color === c}
                aria-label={c}
                onClick={() => set('color')(c)}
                className="pressable flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  background: c,
                  boxShadow:
                    form.color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : undefined,
                }}
              >
                {form.color === c && (
                  <Icon name="check" size={20} strokeWidth={3} className="text-white" />
                )}
              </button>
            ))}
          </div>
        </Section>
        {!isNew && (
          <Section footer="Archived cars are hidden from the switcher but keep their history and stats.">
            <FieldRow label="Archived">
              <Switch checked={form.archived} onChange={set('archived')} label="Archived" />
            </FieldRow>
          </Section>
        )}
      </form>

      {existing && isAdmin(me) && <AccessSection car={existing} />}

      {existing && (
        <p className="mt-6 px-4 text-footnote text-label-2">
          Started at {formatKm(existing.startOdometerKm)}.
        </p>
      )}
      {existing && isAdmin(me) && (
        <Button variant="destructive" className="mt-6 w-full" onClick={() => void remove()}>
          Delete car
        </Button>
      )}
    </Page>
  );
}

/** Admin only: limit a car to some members (online — managed directly on the server). */
function AccessSection({ car }: { car: Car }) {
  const qc = useQueryClient();
  const users = useUsers();
  const members = users.filter((u: PublicUser) => u.role === 'member');
  const key = ['carAccess', car.id];
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => api<{ userIds: string[] }>(`/api/cars/${car.id}/access`),
  });
  const [busy, setBusy] = useState(false);
  const allowed = new Set(data?.userIds ?? []);
  const restricted = allowed.size > 0;

  const update = async (userIds: string[]) => {
    setBusy(true);
    try {
      // A car created moments ago may still be in the outbox; the server must know it first.
      await syncNow();
      const res = await api<{ userIds: string[] }>(`/api/cars/${car.id}/access`, {
        method: 'PUT',
        json: { userIds },
      });
      qc.setQueryData(key, res);
    } catch (err) {
      toast({ tone: 'error', message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (members.length === 0) return null;
  return (
    <Section
      header="Who can use this car"
      footer={
        error
          ? 'Connect to the internet to change access.'
          : restricted
            ? 'Only the people switched on (and admins) can see this car and its records.'
            : 'Shared with everyone in the household. Switch someone off to limit it.'
      }
    >
      {members.map((u) => {
        const on = !restricted || allowed.has(u.id);
        return (
          <FieldRow key={u.id} label={u.displayName}>
            <Switch
              checked={on}
              label={`${u.displayName} can use ${car.name}`}
              onChange={(v) => {
                if (busy || isPending || error) return;
                const base = restricted ? new Set(allowed) : new Set(members.map((m) => m.id));
                if (v) base.add(u.id);
                else base.delete(u.id);
                // Everyone on again → unrestricted.
                const ids = members.every((m) => base.has(m.id))
                  ? []
                  : [...base, ...users.filter((x) => x.role === 'admin').map((a) => a.id)];
                void update(ids);
              }}
            />
          </FieldRow>
        );
      })}
    </Section>
  );
}
