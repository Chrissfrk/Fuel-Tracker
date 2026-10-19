import { useRegisterSW } from 'virtual:pwa-register/react';
import { Icon } from '../components/ui/Icon';

/** "New version available" banner when a new service worker is waiting. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for updates hourly while the app stays open.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div
      className="fixed inset-x-0 z-[65] mx-auto max-w-md px-3"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
      role="status"
    >
      <div className="pop-in flex items-center gap-3 rounded-2xl bg-elevated py-2 pr-2 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        <Icon name="sparkle" size={20} className="shrink-0 text-accent" />
        <button
          type="button"
          className="min-h-11 flex-1 text-left text-subhead"
          onClick={() => void updateServiceWorker(true)}
        >
          <span className="font-semibold">New version available.</span> Tap to reload.
        </button>
        <button
          type="button"
          aria-label="Later"
          onClick={() => setNeedRefresh(false)}
          className="pressable flex h-9 w-9 items-center justify-center rounded-full text-label-2"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}
