import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fill text-label-2">
        <Icon name={icon} size={32} strokeWidth={1.7} />
      </span>
      <h2 className="text-title-3">{title}</h2>
      <p className="mt-1.5 max-w-xs text-subhead text-label-2">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
