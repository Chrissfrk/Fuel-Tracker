import type { ReactNode } from 'react';
import {
  formatPct,
  type BudgetStatus,
  type Delta as DeltaT,
  type ReminderState,
} from '@fuel/shared';
import { Icon } from './Icon';

/** ▲/▼ with %; green when the change is good, red when bad, gray when neutral. */
export function Delta({ d, suffix, compact }: { d: DeltaT; suffix?: string; compact?: boolean }) {
  if (d.direction == null || d.pct == null) return null;
  if (d.direction === 'flat')
    return (
      <span className="text-footnote text-label-2">No change{suffix ? ` ${suffix}` : ''}</span>
    );
  const color = d.good == null ? 'text-label-2' : d.good ? 'text-green-text' : 'text-red-text';
  const word = d.direction === 'up' ? 'up' : 'down';
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-footnote font-medium tabular ${color}`}
      aria-label={`${word} ${formatPct(d.pct)}${suffix ? ` ${suffix}` : ''}${d.good == null ? '' : d.good ? ', better' : ', worse'}`}
    >
      <span aria-hidden>{d.direction === 'up' ? '▲' : '▼'}</span>
      <span aria-hidden>
        {formatPct(d.pct)}
        {!compact && suffix ? ` ${suffix}` : ''}
      </span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  icon,
  tint,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: ReactNode;
  icon?: ReactNode;
  tint?: string;
}) {
  return (
    <div
      className="flex min-h-[104px] flex-col rounded-2xl bg-surface p-3.5"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div
        className="flex items-center gap-1.5 text-subhead font-medium"
        style={{ color: tint ?? 'var(--label-2)' }}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-auto pt-2">
        <div className="truncate text-title-2 tabular">{value}</div>
        {(sub || delta) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-footnote text-label-2">
            {delta}
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

const ringColor: Record<BudgetStatus, string> = {
  ok: 'var(--green)',
  warning: 'var(--orange)',
  over: 'var(--red)',
};

export function Ring({
  ratio,
  status,
  size = 96,
  stroke = 11,
  children,
}: {
  ratio: number;
  status: BudgetStatus;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.min(1, Math.max(0, ratio));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fill)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.25, 1, 0.5, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export const BUDGET_LABEL: Record<BudgetStatus, string> = {
  ok: 'On track',
  warning: 'Close to budget',
  over: 'Over budget',
};

const statusStyle: Record<
  ReminderState,
  { label: string; cls: string; icon: 'warning' | 'calendar' | 'check' }
> = {
  overdue: {
    label: 'Overdue',
    cls: 'text-red-text bg-[color-mix(in_srgb,var(--red)_14%,transparent)]',
    icon: 'warning',
  },
  due_soon: {
    label: 'Due soon',
    cls: 'text-orange-text bg-[color-mix(in_srgb,var(--orange)_16%,transparent)]',
    icon: 'calendar',
  },
  ok: {
    label: 'OK',
    cls: 'text-green-text bg-[color-mix(in_srgb,var(--green)_14%,transparent)]',
    icon: 'check',
  },
};

/** Status shown with colour, icon and word, so it reads without colour too. */
export function StatusBadge({ status }: { status: ReminderState }) {
  const s = statusStyle[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-footnote font-semibold ${s.cls}`}
    >
      <Icon name={s.icon} size={13} strokeWidth={2.6} />
      {s.label}
    </span>
  );
}
