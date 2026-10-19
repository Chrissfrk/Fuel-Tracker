import { useCallback, useRef, useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { Button, Segmented } from '../../components/ui/Controls';
import { Icon } from '../../components/ui/Icon';
import { toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  addSheet,
  canEditRecord,
  useAddSheet,
  useCarSelection,
  useMe,
  type AddMode,
} from '../../app/context';
import { softDelete } from '../../data/mutations';
import { useUserNames } from '../../data/hooks';
import { haptic } from '../../lib/motion';
import { FillupForm } from './FillupForm';
import { ExpenseForm } from './ExpenseForm';
import { OdometerForm } from './OdometerForm';
import type { FormHandle, SaveResult } from './types';
import { Link } from 'react-router';

const MODES = [
  { value: 'fillup', label: 'Fill-up' },
  { value: 'expense', label: 'Expense' },
  { value: 'odometer', label: 'Odometer' },
] as const;

const TABLE = { fillup: 'fillups', expense: 'expenses', odometer: 'odometerReadings' } as const;
const NOUN = { fillup: 'fill-up', expense: 'expense', odometer: 'odometer reading' } as const;

export function AddSheet() {
  const state = useAddSheet();
  const me = useMe();
  const { cars, primaryCar } = useCarSelection();
  const names = useUserNames();
  const form = useRef<FormHandle>(null);
  const [status, setStatus] = useState({ canSave: false, label: 'Save' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const onStatus = useCallback((s: { canSave: boolean; label: string }) => setStatus(s), []);

  const editing = state.editing;
  const mode: AddMode = editing?.kind ?? state.mode;
  const readOnly = editing ? !canEditRecord(me, editing.record) : false;
  const defaultCarId = primaryCar?.id ?? cars[0]?.id ?? '';

  const close = useCallback(() => addSheet.close(), []);
  const canDismiss = useCallback(() => {
    if (!form.current?.isDirty() || saving) return true;
    return window.confirm('Discard this entry?');
  }, [saving]);

  const onDone = (r: SaveResult) => {
    haptic('success');
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      addSheet.close();
      toast({ tone: 'success', message: r.message, action: { label: 'Undo', run: r.undo } });
    }, 520);
  };

  const save = async () => {
    if (!form.current || saving) return;
    setSaving(true);
    try {
      await form.current.submit();
    } catch (err) {
      toast({ tone: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const undo = await softDelete(TABLE[editing.kind], editing.record.id);
    addSheet.close();
    toast({ message: `Deleted ${NOUN[editing.kind]}`, action: { label: 'Undo', run: undo } });
  };

  const header = (
    <div className="px-2 pb-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <button
          type="button"
          onClick={() => canDismiss() && close()}
          className="pressable min-h-11 justify-self-start px-2 text-body text-accent-text"
        >
          {readOnly ? 'Close' : 'Cancel'}
        </button>
        <h2 className="text-headline">
          {editing ? `${readOnly ? 'View' : 'Edit'} ${NOUN[editing.kind]}` : 'New entry'}
        </h2>
        {readOnly ? (
          <span />
        ) : (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!status.canSave || saving}
            className="pressable min-h-11 justify-self-end px-2 text-body font-semibold text-accent-text disabled:opacity-35"
          >
            {status.label}
          </button>
        )}
      </div>
      {!editing && (
        <div className="mx-auto mt-2 max-w-md px-2">
          <Segmented
            label="Entry type"
            options={MODES}
            value={mode}
            onChange={(m) => addSheet.setMode(m)}
          />
        </div>
      )}
    </div>
  );

  const label = editing ? `Edit ${NOUN[mode]}` : `Add ${NOUN[mode]}`;
  // Remount forms when the target changes so their state starts fresh.
  const key = `${mode}:${editing?.record.id ?? 'new'}:${state.open}`;
  const props = { cars, defaultCarId, readOnly, onStatus, onDone, ref: form };

  return (
    <Sheet open={state.open} onClose={close} label={label} header={header} canDismiss={canDismiss}>
      {cars.length === 0 ? (
        <EmptyState
          icon="car"
          title="Add a car first"
          message="Fill-ups and expenses belong to a car. Add your first car to start logging."
          action={
            <Link to="/more/cars/new" onClick={close}>
              <Button size="md">Add a car</Button>
            </Link>
          }
        />
      ) : (
        <>
          {readOnly && editing && (
            <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-subhead text-label-2">
              Logged by {names.get(editing.record.createdBy) ?? 'someone else'}. Only they or an
              admin can change it.
            </p>
          )}
          {mode === 'fillup' && (
            <FillupForm
              key={key}
              {...props}
              editing={editing?.kind === 'fillup' ? editing.record : null}
            />
          )}
          {mode === 'expense' && (
            <ExpenseForm
              key={key}
              {...props}
              editing={editing?.kind === 'expense' ? editing.record : null}
              prefill={state.prefill}
            />
          )}
          {mode === 'odometer' && (
            <OdometerForm
              key={key}
              {...props}
              editing={editing?.kind === 'odometer' ? editing.record : null}
            />
          )}
          {editing && !readOnly && (
            <Button variant="destructive" className="mt-8 w-full" onClick={() => void remove()}>
              <Icon name="trash" size={20} />
              Delete {NOUN[editing.kind]}
            </Button>
          )}
          {editing && (
            <p className="mt-4 text-center text-footnote text-label-2">
              Logged by {names.get(editing.record.createdBy) ?? 'Unknown'}
            </p>
          )}
        </>
      )}

      {success && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          aria-hidden
        >
          <span className="pop-in flex h-24 w-24 items-center justify-center rounded-[28px] bg-elevated shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
            <svg
              width="52"
              height="52"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--green)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path className="draw-check" d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
        </div>
      )}
    </Sheet>
  );
}
