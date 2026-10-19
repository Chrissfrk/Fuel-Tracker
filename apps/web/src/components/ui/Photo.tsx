import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocalPhoto } from '../../data/hooks';
import { Icon } from './Icon';

export function PhotoThumb({ id, size = 56 }: { id: string; size?: number }) {
  const url = useLocalPhoto(id);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!url) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View receipt photo"
        className="pressable overflow-hidden rounded-lg bg-fill"
        style={{ width: size, height: size }}
      >
        {failed ? (
          <span
            className="flex h-full w-full items-center justify-center text-label-3"
            title="Photo available when online"
          >
            <Icon name="photo" size={size * 0.45} />
          </span>
        ) : (
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Receipt photo"
            className="fade-in fixed inset-0 z-[70] flex items-center justify-center bg-black"
            onClick={() => setOpen(false)}
          >
            {failed ? (
              <p className="px-8 text-center text-white">
                This photo isn't on this device yet. It will show when you're online.
              </p>
            ) : (
              <img src={url} alt="Receipt" className="max-h-full max-w-full object-contain" />
            )}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="pressable absolute flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
              style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 16 }}
            >
              <Icon name="x" size={20} strokeWidth={2.4} />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
