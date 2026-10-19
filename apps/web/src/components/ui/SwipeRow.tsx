import { useEffect, useRef, type ReactNode } from 'react';
import {
  SPRING_DEFAULT,
  SPRING_MOMENTUM,
  Spring,
  VelocityTracker,
  haptic,
  project,
  rubberband,
} from '../../lib/motion';
import { Icon } from './Icon';

const ACTION_WIDTH = 84;
let closeOpenRow: (() => void) | null = null;

/**
 * Swipe left to reveal Delete; a long swipe deletes straight away.
 * Direction is locked after ~10 px, so vertical scrolling is never hijacked.
 */
export function SwipeRow({
  children,
  onDelete,
  onTap,
  disabled,
  deleteLabel = 'Delete',
}: {
  children: ReactNode;
  onDelete: () => void;
  onTap?: () => void;
  disabled?: boolean;
  deleteLabel?: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLDivElement>(null);
  const width = useRef(360);
  const spring = useRef<Spring | null>(null);
  const gesture = useRef<{
    x0: number;
    y0: number;
    start: number;
    mode: 'pending' | 'h' | 'v';
  } | null>(null);
  const tracker = useRef(new VelocityTracker());
  const passedThreshold = useRef(false);

  const apply = (x: number) => {
    if (content.current) content.current.style.transform = `translate3d(${x}px,0,0)`;
    if (action.current) action.current.style.width = `${Math.max(0, -x)}px`;
  };
  if (!spring.current) spring.current = new Spring(0, apply);

  useEffect(() => () => spring.current?.stop(), []);

  const close = () => {
    void spring.current!.to(0);
    if (closeOpenRow === close) closeOpenRow = null;
  };

  const commitDelete = (velocity = 0) => {
    haptic('warning');
    void spring.current!.to(-width.current, { velocity, config: SPRING_DEFAULT }).then(() => {
      onDelete();
      spring.current!.set(0);
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
    width.current = content.current?.offsetWidth ?? 360;
    spring.current!.stop();
    gesture.current = {
      x0: e.clientX,
      y0: e.clientY,
      start: spring.current!.value,
      mode: 'pending',
    };
    tracker.current.reset();
    passedThreshold.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.mode === 'pending') {
      // Rows that can't be deleted still take taps; they just never swipe.
      if (disabled && Math.abs(dx) > 10) {
        g.mode = 'v';
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.mode = 'h';
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(dy) > 10) {
        g.mode = 'v';
        return;
      } else return;
    }
    if (g.mode !== 'h') return;
    let x = g.start + dx;
    if (x > 0) x = rubberband(x, width.current, 0.3);
    spring.current!.set(x);
    tracker.current.add(x);
    const past = x < -width.current * 0.6;
    if (past !== passedThreshold.current) {
      passedThreshold.current = past;
      haptic();
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode !== 'h') {
      if (g.mode === 'pending') {
        if (spring.current!.value !== 0) close();
        else onTap?.();
      }
      return;
    }
    const v = tracker.current.velocity;
    const x = spring.current!.value;
    const projected = x + project(v, 0.99);
    if (x < -width.current * 0.6 || projected < -width.current * 0.75) commitDelete(v);
    else if (projected < -ACTION_WIDTH / 2) {
      void spring.current!.to(-ACTION_WIDTH, { velocity: v, config: SPRING_MOMENTUM });
      closeOpenRow = close;
    } else {
      void spring.current!.to(0, { velocity: v, config: SPRING_MOMENTUM });
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        ref={action}
        className="absolute inset-y-0 right-0 flex items-stretch justify-end overflow-hidden bg-red"
        style={{ width: 0 }}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => commitDelete()}
          className="flex min-w-[84px] flex-col items-center justify-center gap-0.5 text-footnote font-medium text-white"
        >
          <Icon name="trash" size={20} />
          {deleteLabel}
        </button>
      </div>
      <div
        ref={content}
        className="row-press relative bg-surface will-change-transform"
        style={{ touchAction: 'pan-y' }}
        role={onTap ? 'button' : undefined}
        tabIndex={onTap ? 0 : undefined}
        aria-keyshortcuts={disabled ? undefined : 'Delete'}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onTap) {
            e.preventDefault();
            onTap();
          } else if ((e.key === 'Delete' || e.key === 'Backspace') && !disabled) {
            e.preventDefault();
            commitDelete();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
          if (spring.current!.value > -ACTION_WIDTH / 2) close();
        }}
      >
        {children}
      </div>
    </div>
  );
}
