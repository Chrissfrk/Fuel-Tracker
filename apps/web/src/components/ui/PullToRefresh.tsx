import { useEffect, useRef, useState, type ReactNode } from 'react';
import { haptic, rubberband } from '../../lib/motion';
import { Spinner } from './Controls';
import { Icon } from './Icon';

const TRIGGER = 72;

/** Pull down at the top of the page to refresh (sync). */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
}) {
  const indicator = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const state = useRef({ startY: 0, pulling: false, dist: 0, armed: false });

  useEffect(() => {
    const el = indicator.current!;
    const setDist = (d: number) => {
      state.current.dist = d;
      el.style.transform = `translate3d(0, ${d - 40}px, 0)`;
      el.style.opacity = String(Math.min(1, d / TRIGGER));
      el.querySelector<HTMLElement>('[data-arrow]')!.style.transform =
        `rotate(${d >= TRIGGER ? 180 : 0}deg)`;
    };
    const start = (e: TouchEvent) => {
      if (window.scrollY > 0 || document.body.style.overflow === 'hidden') return;
      state.current = { startY: e.touches[0]!.clientY, pulling: true, dist: 0, armed: false };
    };
    const move = (e: TouchEvent) => {
      const s = state.current;
      if (!s.pulling) return;
      const dy = e.touches[0]!.clientY - s.startY;
      if (dy <= 0 || window.scrollY > 0) {
        setDist(0);
        return;
      }
      const d = rubberband(dy, window.innerHeight, 0.5);
      setDist(d);
      const armed = d >= TRIGGER;
      if (armed !== s.armed) {
        s.armed = armed;
        if (armed) haptic();
      }
    };
    const end = async () => {
      const s = state.current;
      if (!s.pulling) return;
      s.pulling = false;
      el.style.transition = 'transform 300ms cubic-bezier(0.25,1,0.5,1), opacity 300ms';
      if (s.dist >= TRIGGER) {
        setRefreshing(true);
        setDist(TRIGGER * 0.75);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setDist(0);
        }
      } else setDist(0);
      setTimeout(() => (el.style.transition = ''), 320);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [onRefresh]);

  return (
    <>
      <div
        ref={indicator}
        aria-hidden={!refreshing}
        className="pointer-events-none fixed inset-x-0 z-20 flex justify-center"
        style={{
          top: 'calc(env(safe-area-inset-top) + 44px)',
          transform: 'translate3d(0,-40px,0)',
          opacity: 0,
        }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-label-2 shadow-md">
          {refreshing ? (
            <Spinner size={18} />
          ) : (
            <span data-arrow className="transition-transform duration-200">
              <Icon name="arrowDown" size={18} />
            </span>
          )}
        </span>
        {refreshing && (
          <span className="sr-only" role="status">
            Refreshing
          </span>
        )}
      </div>
      {children}
    </>
  );
}
