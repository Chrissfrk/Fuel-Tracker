import { useState } from 'react';
import { promptInstall, useInstallMode } from '../../lib/install';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Controls';
import { hueStyle } from '../../lib/palette';

const KEY = 'fuel:installDismissed';

/** One-time nudge to add the app to the home screen. */
export function InstallBanner() {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return true;
    }
  });
  if (dismissed || (mode !== 'prompt' && mode !== 'ios')) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <div
      className="tone-card hero mt-3 flex items-start gap-3 rounded-2xl p-4"
      style={hueStyle('blue')}
      role="region"
      aria-label="Install the app"
    >
      <img
        src="/pwa-64x64.png"
        alt=""
        width={44}
        height={44}
        className="rounded-[10px] shadow-[0_4px_12px_-4px_rgba(0,60,160,0.45)]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-headline">Add Fuel to your Home Screen</p>
        {mode === 'ios' ? (
          <p className="mt-0.5 text-subhead text-label-2">
            Tap <Icon name="share" size={16} className="inline -mt-1 text-accent" title="Share" />{' '}
            then “Add to Home Screen”. It opens full-screen and works offline at the pump.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-subhead text-label-2">
              It opens full-screen and works offline at the pump.
            </p>
            <Button
              size="md"
              className="mt-2"
              onClick={() => void promptInstall().then((ok) => ok && dismiss())}
            >
              Install
            </Button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="pressable -mt-1 -mr-1 flex h-9 w-9 items-center justify-center rounded-full text-label-2"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
