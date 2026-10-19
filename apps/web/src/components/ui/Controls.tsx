import { useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { haptic } from '../../lib/motion';

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic();
        onChange(!checked);
      }}
      className="relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--green)' : 'var(--fill-2)' }}
    >
      <span
        className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200"
        style={{
          transform: `translateX(${checked ? 20 : 0}px)`,
          transitionTimingFunction: 'cubic-bezier(0.3, 1.3, 0.5, 1)',
        }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={`relative grid rounded-[9px] bg-fill p-[2px] ${size === 'sm' ? 'h-8' : 'h-9'}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-[2px] bottom-[2px] left-[2px] rounded-[7px] bg-segment-thumb shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-transform duration-300"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => {
            if (o.value !== value) haptic();
            onChange(o.value);
          }}
          className={`relative z-10 truncate px-2 text-subhead transition-[font-weight] ${
            o.value === value ? 'font-semibold' : 'font-medium text-label'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'filled' | 'tinted' | 'plain' | 'destructive';
  size?: 'md' | 'lg';
  loading?: boolean;
};

export function Button({
  variant = 'filled',
  size = 'lg',
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const styles = {
    filled: 'btn-filled text-on-accent',
    tinted: 'bg-accent-soft text-accent-text',
    plain: 'text-accent-text',
    destructive: 'bg-red-soft text-red-text',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`pressable inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-45 ${
        size === 'lg' ? 'min-h-[50px] px-5 text-body' : 'min-h-11 px-4 text-callout'
      } ${styles} ${className}`}
    >
      {loading && <Spinner size={18} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`spin ${className}`} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x="11"
          y="2"
          width="2"
          height="6"
          rx="1"
          fill="currentColor"
          opacity={0.2 + (i / 8) * 0.8}
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Text input for numbers: decimal keypad, accepts `41,2` or `41.2`. */
export function NumberInput({
  value,
  onChange,
  id,
  placeholder,
  suffix,
  autoFocus,
  enterKeyHint = 'next',
  ariaLabel,
  invalid,
  inputMode = 'decimal',
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
  enterKeyHint?: 'next' | 'done';
  ariaLabel?: string;
  invalid?: boolean;
  inputMode?: 'decimal' | 'numeric';
}) {
  const fallbackId = useId();
  return (
    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
      <input
        id={id ?? fallbackId}
        className={`field-input min-w-0 ${invalid ? 'text-red-text' : ''}`}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        enterKeyHint={enterKeyHint}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        data-next-field
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ''))}
      />
      {suffix && <span className="shrink-0 text-body text-label-2">{suffix}</span>}
    </span>
  );
}

/**
 * Pressing Enter/"Next" moves focus to the next field in the form, like a native form.
 * Attach to the form element's onKeyDown.
 */
export function focusNextOnEnter(e: React.KeyboardEvent<HTMLElement>, onLast?: () => void) {
  if (e.key !== 'Enter' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
  const fields = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-next-field]'));
  const i = fields.indexOf(e.target as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const next = fields[i + 1];
  if (next) next.focus();
  else {
    (e.target as HTMLElement).blur();
    onLast?.();
  }
}

export function Chip({
  active,
  onClick,
  children,
  color = 'var(--accent)',
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Identity colour shown when selected (defaults to the accent). Text stays in label colour. */
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`pressable inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-subhead transition-[background-color,box-shadow] duration-150 ${
        active ? 'font-semibold text-label' : 'bg-surface font-medium text-label'
      }`}
      style={
        active
          ? {
              background: `color-mix(in srgb, ${color} 20%, var(--surface))`,
              boxShadow: `inset 0 0 0 1.5px ${color}`,
            }
          : { boxShadow: 'var(--shadow-card)' }
      }
    >
      {children}
    </button>
  );
}
