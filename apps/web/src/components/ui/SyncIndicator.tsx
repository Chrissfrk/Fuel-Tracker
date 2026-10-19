import { useEffect, useState } from 'react';
import { usePendingCount, useSyncStatus } from '../../data/hooks';
import { syncNow } from '../../data/sync';
import { Icon } from './Icon';
import { Spinner } from './Controls';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Small, unobtrusive status: synced ✓ / N waiting / offline. Tap to sync now. */
export function SyncIndicator() {
  const status = useSyncStatus();
  const pending = usePendingCount();
  const online = useOnline();
  const offline = !online || status.state === 'offline';

  let icon: React.ReactNode;
  let text: string;
  let tone: string;
  if (offline) {
    icon = <Icon name="cloudOff" size={16} />;
    text = pending ? `Offline · ${pending} waiting` : 'Offline';
    tone = 'text-orange-text';
  } else if (status.state === 'syncing') {
    icon = <Spinner size={14} />;
    text = pending ? `Syncing ${pending}…` : 'Syncing…';
    tone = 'text-accent-text';
  } else if (pending > 0) {
    icon = <Icon name="cloudArrow" size={16} />;
    text = `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync`;
    tone = 'text-orange-text';
  } else if (status.state === 'error') {
    icon = <Icon name="warning" size={16} />;
    text = 'Sync problem · tap to retry';
    tone = 'text-red-text';
  } else {
    icon = <Icon name="cloudCheck" size={16} />;
    text = 'Synced';
    tone = 'text-green-text';
  }

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      className={`pressable inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-footnote ${tone}`}
      aria-live="polite"
      aria-label={`${text}. Tap to sync now.`}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}
