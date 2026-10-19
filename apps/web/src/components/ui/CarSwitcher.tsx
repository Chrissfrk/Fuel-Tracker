import { useEffect, useRef, useState } from 'react';
import type { Car } from '@fuel/shared';
import { carColor } from '../../lib/theme';
import { haptic } from '../../lib/motion';
import { Icon } from './Icon';

export type CarSelection = string | 'all';

export function CarDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ background: color, width: size, height: size }}
    />
  );
}

/**
 * Large-title car switcher. The menu scales out from the button that opened it.
 */
export function CarSwitcher({
  cars,
  value,
  onChange,
  allowAll = true,
}: {
  cars: Car[];
  value: CarSelection;
  onChange: (v: CarSelection) => void;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const current = cars.find((c) => c.id === value);
  const title = value === 'all' ? 'All cars' : (current?.name ?? 'Choose a car');

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && (setOpen(false), btn.current?.focus());
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    menu.current
      ?.querySelector<HTMLElement>('[aria-checked="true"], [role="menuitemradio"]')
      ?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (v: CarSelection) => {
    haptic();
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  };

  const options: { v: CarSelection; label: string; color: string | null; sub?: string }[] = [
    ...cars.map((c, i) => ({
      v: c.id,
      label: c.name,
      color: carColor(c, i),
      sub: [c.make, c.model].filter(Boolean).join(' '),
    })),
    ...(allowAll && cars.length > 1
      ? [{ v: 'all' as const, label: 'All cars', color: null, sub: 'Household totals' }]
      : []),
  ];

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => cars.length > 0 && setOpen((o) => !o)}
        className="pressable -ml-0.5 flex max-w-full items-center gap-2 rounded-lg text-left"
      >
        {current && <CarDot color={carColor(current, cars.indexOf(current))} size={14} />}
        <span className="truncate text-large-title">{title}</span>
        {cars.length > 0 && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill text-label-2">
            <Icon
              name="chevronDown"
              size={16}
              strokeWidth={2.8}
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </span>
        )}
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Choose car"
          className="pop-in absolute top-full left-0 z-40 mt-2 w-72 max-w-[calc(100vw-32px)] origin-top-left overflow-hidden rounded-2xl bg-elevated shadow-[0_10px_40px_rgba(0,0,0,0.22)]"
        >
          {options.map((o, i) => (
            <button
              key={o.v}
              type="button"
              role="menuitemradio"
              aria-checked={o.v === value}
              onClick={() => choose(o.v)}
              className={`row-press flex min-h-12 w-full items-center gap-3 px-4 text-left ${i > 0 ? 'border-t-[0.5px] border-separator' : ''}`}
            >
              <span className="flex w-5 justify-center text-accent">
                {o.v === value && <Icon name="check" size={18} strokeWidth={2.6} />}
              </span>
              <span className="min-w-0 flex-1 py-2">
                <span className="block truncate text-body">{o.label}</span>
                {o.sub && (
                  <span className="block truncate text-footnote text-label-2">{o.sub}</span>
                )}
              </span>
              {o.color ? (
                <CarDot color={o.color} size={12} />
              ) : (
                <Icon name="car" size={18} className="text-label-2" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
