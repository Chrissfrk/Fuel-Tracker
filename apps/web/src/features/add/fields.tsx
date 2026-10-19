import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Car, SanityWarning } from '@fuel/shared';
import { FieldRow } from '../../components/ui/List';
import { Icon } from '../../components/ui/Icon';
import { CarDot } from '../../components/ui/CarSwitcher';
import { PhotoThumb } from '../../components/ui/Photo';
import { Spinner } from '../../components/ui/Controls';
import { compressImage } from '../../lib/image';
import { carColor } from '../../lib/theme';

export function CarRow({
  cars,
  value,
  onChange,
  disabled,
}: {
  cars: Car[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const car = cars.find((c) => c.id === value);
  return (
    <FieldRow label="Car" htmlFor={id}>
      {car && <CarDot color={carColor(car, cars.indexOf(car))} />}
      <select
        id={id}
        value={value}
        disabled={disabled || cars.length < 2}
        onChange={(e) => onChange(e.target.value)}
        className="field-input appearance-none bg-transparent pr-1 text-label-2 disabled:opacity-100"
        style={{ textAlignLast: 'right' }}
      >
        {cars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {cars.length > 1 && !disabled && (
        <Icon name="chevronUpDown" size={14} className="shrink-0 text-label-3" />
      )}
    </FieldRow>
  );
}

export function DateRow({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const id = useId();
  return (
    <FieldRow label="Date" htmlFor={id} error={error}>
      <input
        id={id}
        type="date"
        required
        value={value}
        disabled={disabled}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="field-input min-w-0 appearance-none bg-transparent text-accent-text disabled:text-label"
      />
    </FieldRow>
  );
}

export function NoteRow({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="row-inner ml-4 py-1 pr-4">
      <label htmlFor={id} className="sr-only">
        Note
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        disabled={disabled}
        maxLength={500}
        placeholder="Note"
        onChange={(e) => onChange(e.target.value)}
        className="block min-h-11 w-full resize-none bg-transparent py-2.5 outline-none placeholder:text-label-3"
      />
    </div>
  );
}

/** Receipt photo: pick/take a photo, compressed in the browser before it's stored. */
export function PhotoRow({
  existingId,
  pending,
  onPick,
  onRemove,
  disabled,
}: {
  existingId: string | null;
  pending: Blob | null;
  onPick: (b: Blob) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (pending ? URL.createObjectURL(pending) : null), [pending]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  const has = pending != null || existingId != null;

  return (
    <div className="row-inner ml-4 flex min-h-11 items-center gap-3 py-2 pr-4">
      {previewUrl ? (
        <img src={previewUrl} alt="Receipt preview" className="h-14 w-14 rounded-lg object-cover" />
      ) : existingId ? (
        <PhotoThumb id={existingId} />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {!disabled && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="pressable flex min-h-11 items-center gap-2 text-left text-accent-text"
            disabled={busy}
          >
            {busy ? <Spinner size={18} /> : <Icon name="camera" size={20} />}
            {has ? 'Replace receipt photo' : 'Add receipt photo'}
          </button>
        )}
        {error && <span className="text-footnote text-red-text">{error}</span>}
      </div>
      {has && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="pressable flex h-11 w-11 items-center justify-center text-label-2"
        >
          <Icon name="trash" size={20} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            onPick(await compressImage(file));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function Warnings({ warnings }: { warnings: SanityWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div
      role="status"
      className="fade-in mt-4 rounded-xl px-4 py-3"
      style={{ background: 'color-mix(in srgb, var(--orange) 14%, var(--surface))' }}
    >
      {warnings.map((w) => (
        <p key={w.code} className="flex gap-2 py-1 text-subhead">
          <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-orange-text" />
          <span>{w.message}</span>
        </p>
      ))}
    </div>
  );
}
