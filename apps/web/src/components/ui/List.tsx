import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from './Icon';

/** Grouped, inset list section (iOS Settings style). */
export function Section({
  header,
  footer,
  children,
  className = '',
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-6 first:mt-3 ${className}`}>
      {header && (
        <h2 className="mb-1.5 px-4 text-footnote font-normal tracking-wide text-label-2 uppercase">
          {header}
        </h2>
      )}
      <div
        className="list-group overflow-hidden rounded-xl bg-surface"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-label-2">{footer}</p>}
    </section>
  );
}

export function IconTile({
  name,
  color,
  size = 30,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[8px] text-white"
      style={{ background: color, width: size, height: size }}
      aria-hidden
    >
      <Icon name={name} size={size * 0.62} strokeWidth={2.1} />
    </span>
  );
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  leading?: ReactNode;
  icon?: { name: IconName; color: string };
  to?: string;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accent?: boolean;
  trailing?: ReactNode;
  ariaLabel?: string;
}

/** A list row. Renders a link, a button or static content depending on props. */
export function Row({
  title,
  subtitle,
  value,
  leading,
  icon,
  to,
  onClick,
  chevron,
  destructive,
  accent,
  trailing,
  ariaLabel,
}: RowProps) {
  const interactive = !!to || !!onClick;
  const content = (
    <>
      {(leading || icon) && (
        <span className="flex shrink-0 items-center py-2 pl-4">
          {leading ?? (icon && <IconTile name={icon.name} color={icon.color} />)}
        </span>
      )}
      <span
        className={`row-inner flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 ${leading || icon ? 'ml-3' : 'ml-4'}`}
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-body ${destructive ? 'text-red-text' : accent ? 'text-accent-text' : ''}`}
          >
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 line-clamp-2 block text-subhead text-label-2">{subtitle}</span>
          )}
        </span>
        {value != null && <span className="shrink-0 text-body text-label-2 tabular">{value}</span>}
        {trailing}
        {(chevron ?? (interactive && !destructive && !accent)) && (
          <Icon name="chevronRight" size={16} strokeWidth={2.6} className="shrink-0 text-label-3" />
        )}
      </span>
    </>
  );
  const cls = 'flex w-full items-stretch text-left';
  if (to) {
    return (
      <Link to={to} className={`${cls} row-press`} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} row-press`} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}

/** Label on the left, control on the right. */
export function FieldRow({
  label,
  htmlFor,
  children,
  error,
  hint,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  error?: string | null;
  hint?: ReactNode;
}) {
  return (
    <div className="flex w-full items-stretch">
      <div className="row-inner ml-4 flex min-h-11 flex-1 flex-col justify-center py-0.5 pr-4">
        <div className="flex min-h-11 items-center gap-3">
          <label htmlFor={htmlFor} className="shrink-0 text-body">
            {label}
          </label>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
        </div>
        {error && (
          <p className="pb-2 text-footnote text-red-text" role="alert">
            {error}
          </p>
        )}
        {hint && !error && <p className="pb-2 text-footnote text-label-2">{hint}</p>}
      </div>
    </div>
  );
}
