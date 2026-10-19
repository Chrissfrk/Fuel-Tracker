import { useId, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  REMINDER_PRESETS,
  averageKmPerDay,
  estimatedOdometer,
  formatDate,
  formatKm,
  isOneOffReminder,
  markReminderDone,
  parseDecimal,
  presetFor,
  reminderStatus,
  reminderStatuses,
  todayIso,
  type Car,
  type Reminder,
  type ReminderStatus,
} from '@fuel/shared';
import { BarButton, Page } from '../../components/ui/Page';
import { FieldRow, Row, Section } from '../../components/ui/List';
import { Button, NumberInput, Switch, focusNextOnEnter } from '../../components/ui/Controls';
import { StatusBadge } from '../../components/ui/Stats';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Sheet } from '../../components/ui/Sheet';
import { CarDot } from '../../components/ui/CarSwitcher';
import { toast } from '../../components/ui/Toast';
import { useCarIdState, useMe } from '../../app/context';
import {
  useCars,
  useExpenses,
  useFillups,
  useOdometerReadings,
  useRecord,
  useReminders,
} from '../../data/hooks';
import { ValidationError, newBase, saveRecord, softDelete } from '../../data/mutations';
import { carColor } from '../../lib/theme';
import { hueVar } from '../../lib/palette';
import { CATEGORY_META, reminderIcon } from '../labels';

/** Reminder statuses for every car, from the estimated odometer and recent km/day. */
function useStatuses() {
  const cars = useCars();
  const fillups = useFillups(null);
  const expenses = useExpenses(null);
  const readings = useOdometerReadings(null);
  const reminders = useReminders(null);
  return useMemo(() => {
    const today = todayIso();
    const ctx = new Map(
      cars.map((car) => {
        const f = fillups.filter((x) => x.carId === car.id);
        return [
          car.id,
          {
            car,
            odometerKm: estimatedOdometer(car, f, readings, expenses).km,
            today,
            kmPerDay: averageKmPerDay(f, today),
          },
        ] as const;
      }),
    );
    return { cars, ctx, statuses: reminderStatuses(reminders, ctx) };
  }, [cars, fillups, expenses, readings, reminders]);
}

export function describeDue(s: ReminderStatus): string {
  const parts: string[] = [];
  if (s.nextDueKm != null && s.kmRemaining != null) {
    parts.push(
      s.kmRemaining < 0
        ? `${formatKm(-s.kmRemaining)} overdue (at ${formatKm(s.nextDueKm)})`
        : `at ${formatKm(s.nextDueKm)} · ${formatKm(s.kmRemaining)} to go`,
    );
  }
  if (s.nextDueDate && s.daysRemaining != null) {
    parts.push(
      s.daysRemaining < 0
        ? `was due ${formatDate(s.nextDueDate)}`
        : `due ${formatDate(s.nextDueDate)}`,
    );
  } else if (s.estimatedKmDueDate) parts.push(`≈ ${formatDate(s.estimatedKmDueDate)}`);
  return parts.join(' · ');
}

export function RemindersPage() {
  const { cars, statuses } = useStatuses();
  const [picker, setPicker] = useState(false);
  const navigate = useNavigate();
  const byCar = cars
    .map((c) => ({ car: c, list: statuses.filter((s) => s.reminder.carId === c.id) }))
    .filter((g) => g.list.length > 0);

  return (
    <Page
      title="Reminders"
      back={{ label: 'More', to: '/more' }}
      trailing={
        cars.length > 0 && (
          <BarButton onClick={() => setPicker(true)} label="Add reminder">
            <Icon name="plus" size={26} strokeWidth={2.2} />
          </BarButton>
        )
      }
    >
      {statuses.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No reminders"
          message="Get a heads-up before the oil change, KTEO, insurance or road tax is due."
          action={
            cars.length > 0 ? (
              <Button onClick={() => setPicker(true)}>Add a reminder</Button>
            ) : undefined
          }
        />
      ) : (
        byCar.map(({ car, list }) => (
          <Section
            key={car.id}
            header={
              <span className="inline-flex items-center gap-1.5">
                <CarDot color={carColor(car, cars.indexOf(car))} size={8} />
                {car.name}
              </span>
            }
          >
            {list.map((s) => (
              <Row
                key={s.reminder.id}
                to={`/more/reminders/${s.reminder.id}`}
                title={s.reminder.title}
                icon={reminderIcon(s.reminder.type)}
                subtitle={describeDue(s)}
                trailing={<StatusBadge status={s.status} />}
              />
            ))}
          </Section>
        ))
      )}

      <Sheet
        open={picker}
        onClose={() => setPicker(false)}
        label="Choose a reminder"
        header={
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pb-3">
            <button
              type="button"
              className="pressable min-h-11 justify-self-start px-2 text-accent-text"
              onClick={() => setPicker(false)}
            >
              Cancel
            </button>
            <h2 className="text-headline">New reminder</h2>
            <span />
          </div>
        }
      >
        <Section header="Presets">
          {REMINDER_PRESETS.map((p) => (
            <Row
              key={p.type}
              title={p.title}
              subtitle={[
                p.everyKm ? `every ${formatKm(p.everyKm)}` : null,
                p.everyMonths ? `every ${p.everyMonths} months` : null,
              ]
                .filter(Boolean)
                .join(' or ')}
              icon={{
                name: CATEGORY_META[p.category].icon,
                color: CATEGORY_META[p.category].color,
              }}
              onClick={() => {
                setPicker(false);
                navigate(`/more/reminders/new?preset=${p.type}`);
              }}
            />
          ))}
        </Section>
        <Section>
          <Row
            title="Custom reminder"
            icon={{ name: 'pencil', color: hueVar('indigo') }}
            onClick={() => {
              setPicker(false);
              navigate('/more/reminders/new');
            }}
          />
        </Section>
      </Sheet>
    </Page>
  );
}

export function ReminderEditPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const record = useRecord('reminders', isNew ? undefined : id);
  if (!isNew && record === undefined)
    return (
      <Page title="Reminder" back={{ label: 'Reminders', to: '/more/reminders' }}>
        {null}
      </Page>
    );
  if (!isNew && !record) {
    return (
      <Page title="Reminder" back={{ label: 'Reminders', to: '/more/reminders' }}>
        <EmptyState icon="bell" title="Reminder not found" message="It may have been deleted." />
      </Page>
    );
  }
  return <ReminderForm key={id} existing={isNew ? null : record!} />;
}

function ReminderForm({ existing }: { existing: Reminder | null }) {
  const [params] = useSearchParams();
  const isNew = existing == null;
  const me = useMe();
  const navigate = useNavigate();
  const { cars, ctx, statuses } = useStatuses();
  const preset = presetFor(params.get('preset') ?? '');
  const uid = useId();

  const init = existing ?? null;
  const [carId, setCarId] = useCarIdState(init?.carId);
  const [title, setTitle] = useState(init?.title ?? preset?.title ?? '');
  const [everyKm, setEveryKm] = useState(String(init?.everyKm ?? preset?.everyKm ?? ''));
  const [everyMonths, setEveryMonths] = useState(
    String(init?.everyMonths ?? preset?.everyMonths ?? ''),
  );
  const [lastKm, setLastKm] = useState(
    init?.lastDoneKm != null ? String(Math.round(init.lastDoneKm)) : '',
  );
  const [lastDate, setLastDate] = useState(init?.lastDoneDate ?? '');
  const [dueDate, setDueDate] = useState(init?.dueDate ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [doneOpen, setDoneOpen] = useState(false);

  const fixed = preset?.fixedDate ?? (init ? init.dueDate != null : false);
  const status = existing ? statuses.find((s) => s.reminder.id === existing.id) : null;
  const odometerNow = ctx.get(carId)?.odometerKm;

  const build = (): Reminder => ({
    ...(existing ?? newBase(me.id)),
    carId,
    type: existing?.type ?? preset?.type ?? 'custom',
    title: title.trim(),
    everyKm: parseDecimal(everyKm) != null ? Math.round(parseDecimal(everyKm)!) : null,
    everyMonths: parseDecimal(everyMonths) != null ? Math.round(parseDecimal(everyMonths)!) : null,
    lastDoneKm: parseDecimal(lastKm),
    lastDoneDate: lastDate || null,
    dueDate: dueDate || null,
  });

  const save = async () => {
    try {
      await saveRecord('reminders', build());
      toast({ tone: 'success', message: 'Reminder saved' });
      navigate('/more/reminders', { replace: true });
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.fieldErrors);
        toast({ tone: 'error', message: err.message });
      } else throw err;
    }
  };

  const remove = async () => {
    if (!existing) return;
    const undo = await softDelete('reminders', existing.id);
    toast({ message: 'Reminder deleted', action: { label: 'Undo', run: undo } });
    navigate('/more/reminders', { replace: true });
  };

  const car = cars.find((c) => c.id === carId);
  const preview = useMemo(() => {
    const c = ctx.get(carId);
    if (!c) return null;
    try {
      const r = build();
      if (r.everyKm == null && r.everyMonths == null && r.dueDate == null) return null;
      return reminderStatus(r, c);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId, everyKm, everyMonths, lastKm, lastDate, dueDate, ctx]);

  return (
    <Page
      title={isNew ? 'New reminder' : title || 'Reminder'}
      back={{ label: 'Reminders', to: '/more/reminders' }}
      trailing={
        <BarButton onClick={() => void save()} bold>
          Save
        </BarButton>
      }
    >
      {status && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface p-4">
          <div className="min-w-0">
            <StatusBadge status={status.status} />
            <p className="mt-1.5 text-subhead text-label-2">{describeDue(status)}</p>
          </div>
          <Button size="md" onClick={() => setDoneOpen(true)}>
            Mark done
          </Button>
        </div>
      )}
      <form
        onSubmit={(e) => (e.preventDefault(), void save())}
        onKeyDown={(e) => focusNextOnEnter(e)}
        noValidate
      >
        <Section>
          <FieldRow label="Title" htmlFor={`${uid}t`} error={errors.title}>
            <input
              id={`${uid}t`}
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Oil change"
              data-next-field
              autoFocus={isNew && !preset}
            />
          </FieldRow>
          <FieldRow label="Car" htmlFor={`${uid}c`}>
            {car && <CarDot color={carColor(car, cars.indexOf(car))} />}
            <select
              id={`${uid}c`}
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
              className="field-input appearance-none bg-transparent text-label-2"
              style={{ textAlignLast: 'right' }}
            >
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FieldRow>
        </Section>
        <Section header="Repeat" footer="Whichever comes first. Leave a field empty to ignore it.">
          <FieldRow label="Every" htmlFor={`${uid}k`} error={errors.everyKm}>
            <NumberInput
              id={`${uid}k`}
              value={everyKm}
              onChange={setEveryKm}
              suffix="km"
              placeholder="–"
              inputMode="numeric"
            />
          </FieldRow>
          <FieldRow label="Every" htmlFor={`${uid}m`}>
            <NumberInput
              id={`${uid}m`}
              value={everyMonths}
              onChange={setEveryMonths}
              suffix="months"
              placeholder="–"
              inputMode="numeric"
            />
          </FieldRow>
        </Section>
        {fixed ? (
          <Section
            header="Due date"
            footer="For renewals with a fixed date, like insurance or road tax. It moves forward by the interval when you mark it done."
          >
            <FieldRow label="Due on" htmlFor={`${uid}d`}>
              <input
                id={`${uid}d`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="field-input bg-transparent text-accent-text"
              />
            </FieldRow>
          </Section>
        ) : (
          <Section
            header="Last done"
            footer={
              odometerNow != null
                ? `Current estimated odometer: ≈ ${formatKm(odometerNow)}`
                : undefined
            }
          >
            <FieldRow label="At" htmlFor={`${uid}lk`}>
              <NumberInput
                id={`${uid}lk`}
                value={lastKm}
                onChange={setLastKm}
                suffix="km"
                placeholder={odometerNow ? String(Math.round(odometerNow)) : '–'}
                inputMode="numeric"
              />
            </FieldRow>
            <FieldRow label="On" htmlFor={`${uid}ld`}>
              <input
                id={`${uid}ld`}
                type="date"
                value={lastDate}
                onChange={(e) => setLastDate(e.target.value)}
                className="field-input bg-transparent text-accent-text"
              />
            </FieldRow>
            <Row
              title="Use a fixed due date instead"
              accent
              onClick={() => setDueDate(dueDate || todayIso())}
            />
          </Section>
        )}
        {!fixed && dueDate && (
          <Section>
            <FieldRow label="Due on" htmlFor={`${uid}d2`}>
              <input
                id={`${uid}d2`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="field-input bg-transparent text-accent-text"
              />
            </FieldRow>
          </Section>
        )}
      </form>
      {preview && !status && (
        <p className="mt-4 flex items-center gap-2 px-4 text-subhead text-label-2">
          <StatusBadge status={preview.status} /> {describeDue(preview)}
        </p>
      )}
      {existing && (
        <Button variant="destructive" className="mt-8 w-full" onClick={() => void remove()}>
          Delete reminder
        </Button>
      )}
      {existing && car && (
        <MarkDoneSheet
          open={doneOpen}
          onClose={() => setDoneOpen(false)}
          reminder={existing}
          car={car}
          odometerKm={odometerNow ?? null}
          onDone={() => navigate('/more/reminders', { replace: true })}
        />
      )}
    </Page>
  );
}

function MarkDoneSheet({
  open,
  onClose,
  reminder,
  car,
  odometerKm,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  reminder: Reminder;
  car: Car;
  odometerKm: number | null;
  onDone: () => void;
}) {
  const me = useMe();
  const uid = useId();
  const category = presetFor(reminder.type)?.category ?? 'service';
  const [date, setDate] = useState(todayIso());
  const [km, setKm] = useState(odometerKm != null ? String(Math.round(odometerKm)) : '');
  const [logExpense, setLogExpense] = useState(true);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const kmN = parseDecimal(km);
      const amountN = parseDecimal(amount);
      if (logExpense && amountN != null && amountN > 0) {
        await saveRecord('expenses', {
          ...newBase(me.id),
          carId: car.id,
          date,
          category,
          amount: amountN,
          odometerKm: kmN,
          note: reminder.title,
          receiptPhotoId: null,
        });
      }
      if (isOneOffReminder(reminder)) await softDelete('reminders', reminder.id);
      else
        await saveRecord('reminders', {
          ...reminder,
          ...markReminderDone(reminder, { date, km: kmN }),
        });
      toast({ tone: 'success', message: `${reminder.title} marked done` });
      onClose();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Mark done"
      header={
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pb-3">
          <button
            type="button"
            className="pressable min-h-11 justify-self-start px-2 text-accent-text"
            onClick={onClose}
          >
            Cancel
          </button>
          <h2 className="text-headline">Mark done</h2>
          <button
            type="button"
            disabled={busy}
            className="pressable min-h-11 justify-self-end px-2 font-semibold text-accent-text disabled:opacity-40"
            onClick={() => void confirm()}
          >
            Done
          </button>
        </div>
      }
    >
      <p className="mt-3 px-4 text-subhead text-label-2">
        {reminder.title} · {car.name}
      </p>
      <Section>
        <FieldRow label="Date" htmlFor={`${uid}d`}>
          <input
            id={`${uid}d`}
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="field-input bg-transparent text-accent-text"
          />
        </FieldRow>
        <FieldRow label="Odometer" htmlFor={`${uid}k`}>
          <NumberInput id={`${uid}k`} value={km} onChange={setKm} suffix="km" inputMode="numeric" />
        </FieldRow>
      </Section>
      <Section
        footer={`Adds a ${CATEGORY_META[category].label.toLowerCase()} expense with this odometer reading.`}
      >
        <FieldRow label="Also log an expense">
          <Switch checked={logExpense} onChange={setLogExpense} label="Also log an expense" />
        </FieldRow>
        {logExpense && (
          <FieldRow label="Amount" htmlFor={`${uid}a`}>
            <NumberInput
              id={`${uid}a`}
              value={amount}
              onChange={setAmount}
              suffix="€"
              placeholder="0,00"
              autoFocus
            />
          </FieldRow>
        )}
      </Section>
    </Sheet>
  );
}
