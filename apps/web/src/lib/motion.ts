/**
 * Small spring + gesture toolkit (Apple "Designing Fluid Interfaces" model):
 * springs are described by damping ratio + response, always start from the current
 * on-screen value and inherit the gesture's velocity, so they can be interrupted any time.
 */

export interface SpringConfig {
  /** 1 = critically damped (no overshoot). < 1 bounces. */
  damping: number;
  /** Seconds to (roughly) reach the target. Not a duration. */
  response: number;
}

export const SPRING_DEFAULT: SpringConfig = { damping: 1, response: 0.35 };
/** Only after a gesture that carried momentum. */
export const SPRING_MOMENTUM: SpringConfig = { damping: 0.82, response: 0.32 };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Spring {
  value: number;
  velocity = 0;
  private target: number;
  private raf = 0;
  private last = 0;
  private config: SpringConfig = SPRING_DEFAULT;
  private resolve: (() => void) | null = null;

  constructor(
    initial: number,
    private onUpdate: (v: number) => void,
  ) {
    this.value = initial;
    this.target = initial;
  }

  get animating() {
    return this.raf !== 0;
  }

  /** Jump without animating (e.g. while a finger drags the value). */
  set(v: number) {
    this.stop();
    this.value = v;
    this.target = v;
    this.velocity = 0;
    this.onUpdate(v);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resolve?.();
    this.resolve = null;
  }

  /** Animate to `target`, continuing from the current value and (optionally) a release velocity in px/s. */
  to(target: number, opts: { config?: SpringConfig; velocity?: number } = {}): Promise<void> {
    if (opts.velocity != null) this.velocity = opts.velocity;
    this.target = target;
    this.config = opts.config ?? SPRING_DEFAULT;
    if (prefersReducedMotion()) {
      this.set(target);
      return Promise.resolve();
    }
    this.resolve?.();
    const done = new Promise<void>((r) => (this.resolve = r));
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
    return done;
  }

  private tick = (now: number) => {
    const { damping, response } = this.config;
    const k = ((2 * Math.PI) / response) ** 2;
    const c = (4 * Math.PI * damping) / response;
    let dt = Math.min(0.064, (now - this.last) / 1000);
    this.last = now;
    // Fixed sub-steps keep the integration stable on slow frames.
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      const a = -k * (this.value - this.target) - c * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    if (Math.abs(this.velocity) < 2 && Math.abs(this.value - this.target) < 0.3) {
      this.value = this.target;
      this.velocity = 0;
      this.onUpdate(this.value);
      this.raf = 0;
      this.resolve?.();
      this.resolve = null;
      return;
    }
    this.onUpdate(this.value);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** Where a flick would come to rest (scroll-like deceleration). */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Velocity from the last ~100 ms of pointer samples. */
export class VelocityTracker {
  private samples: { t: number; v: number }[] = [];
  add(v: number, t = performance.now()) {
    this.samples.push({ t, v });
    while (this.samples.length > 2 && t - this.samples[0]!.t > 100) this.samples.shift();
  }
  reset() {
    this.samples = [];
  }
  /** px/s */
  get velocity() {
    if (this.samples.length < 2) return 0;
    const a = this.samples[0]!;
    const b = this.samples[this.samples.length - 1]!;
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.v - a.v) / dt : 0;
  }
}

/** Light haptic tick where supported (Android); a no-op elsewhere. */
export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  try {
    navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'warning' ? [20, 60, 20] : 8);
  } catch {
    /* unsupported */
  }
}
