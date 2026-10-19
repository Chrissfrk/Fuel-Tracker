import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  SPRING_DEFAULT,
  SPRING_MOMENTUM,
  Spring,
  VelocityTracker,
  haptic,
  project,
  rubberband,
} from '../../lib/motion';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name. */
  label: string;
  /** Fixed header (drag handle area): title, segmented control, buttons. */
  header?: ReactNode;
  children: ReactNode;
  /** Ask before a drag/scrim dismiss (e.g. unsaved input). Return true to allow. */
  canDismiss?: () => boolean;
}

/**
 * Bottom sheet with drag-to-dismiss. The sheet follows the finger 1:1, release velocity is
 * handed to the spring and projected forward to decide whether it closes; it can be grabbed
 * again mid-animation.
 */
export function Sheet({ open, onClose, label, header, children, canDismiss }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const spring = useRef<Spring | null>(null);
  const height = useRef(800);
  const lastFocus = useRef<HTMLElement | null>(null);

  const apply = useCallback((y: number) => {
    const h = height.current;
    if (panel.current) panel.current.style.transform = `translate3d(0, ${y}px, 0)`;
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, Math.min(1, 1 - y / h)));
  }, []);

  if (!spring.current) spring.current = new Spring(2000, apply);

  // Open / close in response to the prop.
  useEffect(() => {
    if (open) setMounted(true);
    else if (mounted) {
      void spring.current!.to(height.current + 40, { config: SPRING_DEFAULT }).then(() => {
        if (!openRef.current) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const openRef = useRef(open);
  openRef.current = open;

  useLayoutEffect(() => {
    if (!mounted || !open || !panel.current) return;
    height.current = panel.current.offsetHeight;
    const s = spring.current!;
    if (!s.animating && s.value >= height.current) s.set(height.current + 40);
    void s.to(0, { config: SPRING_DEFAULT });
  }, [mounted, open]);

  // Focus management + Escape.
  useEffect(() => {
    if (!mounted) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (!canDismiss || canDismiss())) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [mounted, onClose, canDismiss]);

  // ---- Drag handling (pointer on header, touch on content when scrolled to top) ----
  const drag = useRef<{
    startY: number;
    startValue: number;
    active: boolean;
    decided: boolean;
  } | null>(null);
  const tracker = useRef(new VelocityTracker());

  const begin = (y: number) => {
    const s = spring.current!;
    s.stop(); // grab it mid-flight from where it is
    drag.current = { startY: y, startValue: s.value, active: false, decided: false };
    tracker.current.reset();
  };
  const move = (y: number): boolean => {
    const d = drag.current;
    if (!d) return false;
    const dy = y - d.startY;
    if (!d.decided) {
      if (Math.abs(dy) < 6) return false;
      d.decided = true;
      d.active = dy > 0 || d.startValue > 0;
      if (!d.active) {
        drag.current = null;
        return false;
      }
    }
    let next = d.startValue + dy;
    if (next < 0) next = rubberband(next, height.current); // resist pulling up past fully open
    spring.current!.set(next);
    tracker.current.add(next);
    return true;
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) {
      if (d && spring.current!.value !== 0) void spring.current!.to(0);
      return;
    }
    const s = spring.current!;
    const v = tracker.current.velocity;
    const projected = s.value + project(v, 0.99);
    const shouldClose = projected > height.current * 0.45 && (!canDismiss || canDismiss());
    if (shouldClose) {
      haptic();
      void s.to(height.current + 40, { velocity: v, config: SPRING_DEFAULT });
      onClose();
    } else {
      void s.to(0, { velocity: v, config: SPRING_MOMENTUM });
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, [role="radio"]'))
      return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    begin(e.clientY);
  };

  // Content area: take over from scrolling only when already at the top and pulling down.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !mounted) return;
    let startY = 0;
    let tracking = false;
    const ts = (e: TouchEvent) => {
      startY = e.touches[0]!.clientY;
      tracking = el.scrollTop <= 0;
      if (tracking) begin(startY);
    };
    const tm = (e: TouchEvent) => {
      if (!tracking) return;
      const y = e.touches[0]!.clientY;
      if (y - startY < 0 && !drag.current?.active) {
        tracking = false;
        drag.current = null;
        return;
      }
      if (move(y)) e.preventDefault();
    };
    const te = () => {
      if (tracking) end();
      tracking = false;
    };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    el.addEventListener('touchcancel', te);
    return () => {
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', te);
      el.removeEventListener('touchcancel', te);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        ref={scrim}
        className="absolute inset-0"
        style={{ background: 'var(--scrim)', opacity: 0 }}
        onClick={() => {
          if (!canDismiss || canDismiss()) onClose();
        }}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-w-2xl flex-col rounded-t-[14px] bg-bg will-change-transform"
        style={{
          maxHeight: 'calc(100dvh - env(safe-area-inset-top) - 10px)',
          height: 'calc(100dvh - env(safe-area-inset-top) - 10px)',
          boxShadow: 'var(--shadow-sheet)',
          transform: 'translate3d(0, 2000px, 0)',
        }}
      >
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={(e) => drag.current && move(e.clientY)}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div className="flex justify-center pt-1.5 pb-1" aria-hidden>
            <span className="h-[5px] w-9 rounded-full bg-label-3" />
          </div>
          {header}
        </div>
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
