export type Ease = (t: number) => number;

export const easeOutQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack: Ease = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
export const easeLinear: Ease = (t) => t;

interface Tween {
  obj: Record<string, number>;
  from: Record<string, number>;
  to: Record<string, number>;
  duration: number;
  delay: number;
  elapsed: number;
  ease: Ease;
  onComplete?: () => void;
  done: boolean;
}

/** Tiny tween manager: numeric properties on plain objects. */
export class Tweens {
  private list: Tween[] = [];

  to(
    obj: Record<string, number>,
    to: Record<string, number>,
    duration: number,
    opts: { ease?: Ease; delay?: number; onComplete?: () => void } = {},
  ): Tween {
    const tw: Tween = {
      obj,
      from: {},
      to,
      duration: Math.max(1, duration),
      delay: opts.delay ?? 0,
      elapsed: 0,
      ease: opts.ease ?? easeOutQuad,
      onComplete: opts.onComplete,
      done: false,
    };
    this.list.push(tw);
    return tw;
  }

  /** Resolves after `ms` milliseconds of (unpaused) scene time. */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.to({}, {}, ms, { onComplete: resolve, ease: easeLinear }));
  }

  update(dt: number): void {
    for (const tw of this.list) {
      if (tw.done) continue;
      if (tw.delay > 0) {
        tw.delay -= dt;
        if (tw.delay > 0) continue;
        dt = -tw.delay;
        tw.delay = 0;
      }
      if (tw.elapsed === 0) for (const k of Object.keys(tw.to)) tw.from[k] = tw.obj[k] ?? 0;
      tw.elapsed += dt;
      const p = Math.min(1, tw.elapsed / tw.duration);
      const e = tw.ease(p);
      for (const k of Object.keys(tw.to)) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (p >= 1) {
        tw.done = true;
        tw.onComplete?.();
      }
    }
    this.list = this.list.filter((t) => !t.done);
  }

  clear(): void {
    this.list = [];
  }

  get active(): number {
    return this.list.length;
  }
}
