import { useEffect, useSyncExternalStore } from 'react';
import { Icon } from './Icon';

export interface ToastItem {
  id: number;
  message: string;
  tone?: 'default' | 'success' | 'error';
  action?: { label: string; run: () => void | Promise<void> };
  duration?: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<ToastItem, 'id'>) {
  const item = { ...t, id: nextId++ };
  items = [...items.slice(-2), item];
  emit();
  return item.id;
}
export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}

function ToastView({ t }: { t: ToastItem }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(t.id), t.duration ?? (t.action ? 5000 : 3000));
    return () => clearTimeout(timer);
  }, [t]);
  return (
    <div
      className="pop-in pointer-events-auto flex min-h-12 w-full items-center gap-3 rounded-2xl py-2 pr-2 pl-4 text-white shadow-lg"
      style={{ background: 'rgba(30,30,32,0.94)' }}
      role={t.tone === 'error' ? 'alert' : 'status'}
    >
      {t.tone === 'success' && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green">
          <Icon name="check" size={16} strokeWidth={3} />
        </span>
      )}
      {t.tone === 'error' && <Icon name="warning" size={20} className="shrink-0 text-orange" />}
      <span className="min-w-0 flex-1 text-subhead">{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="pressable min-h-10 shrink-0 rounded-xl px-3 text-subhead font-semibold text-[#64b5ff]"
          onClick={() => {
            dismissToast(t.id);
            void t.action!.run();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export function Toaster() {
  const list = useToasts();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-md flex-col gap-2 px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
      aria-live="polite"
    >
      {list.map((t) => (
        <ToastView key={t.id} t={t} />
      ))}
    </div>
  );
}
