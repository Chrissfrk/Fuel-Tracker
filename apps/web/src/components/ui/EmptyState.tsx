import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { hueStyle, hueVar, type Hue } from '../../lib/palette';

export function EmptyState({
  icon,
  title,
  message,
  action,
  tone = 'blue',
}: {
  tone?: Hue;
  icon: IconName;
  title: string;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span
        className="tone-icon mb-4 h-[72px] w-[72px] rounded-[22px]"
        style={{
          ...hueStyle(tone),
          boxShadow: `0 10px 30px -12px ${hueVar(tone)}`,
        }}
      >
        <Icon name={icon} size={34} strokeWidth={1.8} />
      </span>
      <h2 className="text-title-3">{title}</h2>
      <p className="mt-1.5 max-w-xs text-subhead text-label-2">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
