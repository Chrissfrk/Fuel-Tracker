import { NavLink } from 'react-router';
import { Icon, type IconName } from './Icon';
import { haptic } from '../../lib/motion';

const tabs: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/stats', label: 'Stats', icon: 'stats' },
  { to: '/more', label: 'More', icon: 'more' },
];

export function TabBar({ onAdd }: { onAdd: () => void }) {
  const item = (t: (typeof tabs)[number]) => (
    <NavLink
      key={t.to}
      to={t.to}
      end={t.end}
      className={({ isActive }) =>
        `pressable flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 ${
          isActive ? 'text-accent' : 'text-label-2'
        }`
      }
    >
      <Icon name={t.icon} size={25} strokeWidth={1.9} />
      <span className="text-caption-2 font-medium">{t.label}</span>
    </NavLink>
  );
  return (
    <nav
      aria-label="Main"
      className="material-bar fixed inset-x-0 bottom-0 z-40"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -0.5px 0 var(--bar-edge)',
      }}
    >
      <div className="mx-auto flex h-[50px] max-w-xl items-stretch px-1">
        {item(tabs[0]!)}
        {item(tabs[1]!)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Add a fill-up or expense"
            onClick={() => {
              haptic();
              onAdd();
            }}
            className="pressable flex h-11 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_40%,transparent)]"
          >
            <Icon name="plus" size={26} strokeWidth={2.6} />
          </button>
        </div>
        {item(tabs[2]!)}
        {item(tabs[3]!)}
      </div>
    </nav>
  );
}
