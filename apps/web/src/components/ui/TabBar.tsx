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
        `pressable flex min-h-12 flex-1 items-center justify-center ${
          isActive ? 'text-accent-text' : 'text-label-2'
        }`
      }
    >
      {({ isActive }) => (
        <span
          className={`flex min-w-16 flex-col items-center gap-0.5 rounded-full px-3 py-[3px] transition-colors duration-200 ${
            isActive ? 'bg-accent-soft' : ''
          }`}
        >
          <Icon name={t.icon} size={24} strokeWidth={isActive ? 2.2 : 1.9} />
          <span className={`text-caption-2 ${isActive ? 'font-semibold' : 'font-medium'}`}>
            {t.label}
          </span>
        </span>
      )}
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
            className="pressable flex h-11 w-14 items-center justify-center rounded-full text-on-accent shadow-[0_6px_18px_-4px_color-mix(in_srgb,var(--accent)_60%,transparent)]"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--accent) 70%, var(--cyan)) 0%, var(--accent) 50%, color-mix(in srgb, var(--accent) 65%, var(--indigo)) 100%)',
            }}
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
